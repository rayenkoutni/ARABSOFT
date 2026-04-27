import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"
import Groq from "groq-sdk"

// POST /api/projects/[id]/generate-tasks - Generate tasks using AI (CHEF only)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== "CHEF") {
    return NextResponse.json({ error: "Accès refusé: seul un chef peut générer des tâches" }, { status: 403 })
  }

  const { id: projectId } = await params

  try {
    // Check if GROQ_API_KEY is configured
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "Clé API Groq non configurée. Veuillez ajouter GROQ_API_KEY dans le fichier .env" },
        { status: 500 }
      )
    }

    // Get the project with team members
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            position: true,
            role: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: "Projet non trouvé" }, { status: 404 })
    }

    // Check if CHEF has access to this project
    const teamMembers = await prisma.employee.findMany({
      where: { managerId: user.id },
      select: { id: true }
    })
    const teamIds = teamMembers.map(e => e.id)
    const isAuthorized = 
      project.createdById === user.id ||
      project.managerId === user.id ||
      project.team.some((member: { id: string }) => teamIds.includes(member.id))
    if (!isAuthorized) {
      return NextResponse.json({ error: "Accès refusé à ce projet" }, { status: 403 })
    }

    if (project.team.length === 0) {
      return NextResponse.json(
        { error: "Aucun membre dans l'équipe. Veuillez d'abord assigner des membres au projet." },
        { status: 400 }
      )
    }

    // Initialize Groq
    const groq = new Groq({ apiKey })

    // Build the team members info
    const members = project.team.map(m => ({
      id: m.id,
      name: m.name,
      jobTitle: m.position || m.role
    }))

    const membersInfo = members
      .map(m => `- id: ${m.id} | name: ${m.name} | job title: ${m.jobTitle}`)
      .join("\n")

    // Call Groq API
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `You are a project management assistant. 
          Given a project description and a team with specific job titles, 
          break the project into clear actionable tasks and assign each task 
          to the most suitable team member based on their job title.
          Respond ONLY with a raw JSON array. 
          No markdown, no code blocks, no explanation — just the JSON array.`
        },
        {
          role: "user",
          content: `
Project name: ${project.name}
Description: ${project.description || 'Aucune description'}
Start date: ${project.startDate ? new Date(project.startDate).toISOString() : 'Non définie'}
End date: ${project.endDate ? new Date(project.endDate).toISOString() : 'Non définie'}

Team members:
${membersInfo}

Return a JSON array where each object has exactly these fields:
{
  "title": string,
  "description": string,
  "assignedUserId": string (must be one of the ids above),
  "dueDate": string (ISO format, between start and end date),
  "priority": "HIGH" | "MEDIUM" | "LOW"
}`
        }
      ]
    })

    const text = completion.choices[0]?.message?.content
    if (!text) {
      return NextResponse.json(
        { error: "L'IA n'a pas pu générer les tâches. Veuillez créer les tâches manuellement." },
        { status: 422 }
      )
    }

    // Clean response (remove markdown if any)
    const clean = text.replace(/```json|```/g, "").trim()

    // Parse the JSON
    let generatedTasks
    try {
      generatedTasks = JSON.parse(clean)
    } catch (parseError) {
      console.error("Failed to parse AI response:", clean)
      return NextResponse.json(
        { error: "L'IA n'a pas pu générer les tâches. Veuillez créer les tâches manuellement." },
        { status: 422 }
      )
    }

    // Validate generated tasks structure
    if (!Array.isArray(generatedTasks)) {
      return NextResponse.json(
        { error: "Format de réponse invalide de l'IA" },
        { status: 422 }
      )
    }

    // Validate each task has required fields
    for (const task of generatedTasks) {
      if (!task.title || !task.assignedUserId || !task.dueDate || !task.priority) {
        return NextResponse.json(
          { error: "Les tâches générées sont incomplètes" },
          { status: 422 }
        )
      }
      
      // Verify assignedUserId exists in team
      const validUser = project.team.find(m => m.id === task.assignedUserId)
      if (!validUser) {
        return NextResponse.json(
          { error: `Utilisateur invalide assigné: ${task.assignedUserId}` },
          { status: 422 }
        )
      }
    }

    // Return tasks for preview (without saving yet)
    return NextResponse.json({
      tasks: generatedTasks,
      projectName: project.name,
      teamMembers: project.team
    })

  } catch (error: any) {
    console.error("Error generating tasks:", error)
    
    // Check for API error
    if (error.status === 429 || error.message?.includes('429')) {
      return NextResponse.json(
        { error: "Quota API Groq dépassé. Veuillez réessayer plus tard." },
        { status: 429 }
      )
    }
    
    return NextResponse.json(
      { error: "Erreur lors de la génération des tâches par l'IA" },
      { status: 500 }
    )
  }
}

// PUT /api/projects/[id]/generate-tasks - Save generated tasks (CHEF only)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== "CHEF") {
    return NextResponse.json({ error: "Accès refusé: seul un chef peut sauvegarder des tâches" }, { status: 403 })
  }

  const { id: projectId } = await params

  try {
    const body = await req.json()
    const { tasks } = body

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ error: "Aucune tâche à sauvegarder" }, { status: 400 })
    }

    // Get project name for notifications
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { team: { select: { id: true } } }
    })

    if (!project) {
      return NextResponse.json({ error: "Projet non trouvé" }, { status: 404 })
    }

    // Check if CHEF has access to this project
    const teamMembers = await prisma.employee.findMany({
      where: { managerId: user.id },
      select: { id: true }
    })
    const teamIds = teamMembers.map(e => e.id)
    const isAuthorized = 
      project.createdById === user.id ||
      project.managerId === user.id ||
      project.team.some((member: { id: string }) => teamIds.includes(member.id))
    if (!isAuthorized) {
      return NextResponse.json({ error: "Accès refusé à ce projet" }, { status: 403 })
    }

    // Create all tasks
    const createdTasks = await Promise.all(
      tasks.map(async (task) => {
        return prisma.task.create({
          data: {
            title: task.title,
            description: task.description,
            assigneeId: task.assignedUserId,
            projectId,
            dueDate: new Date(task.dueDate),
            priority: task.priority,
            status: "TODO"
          }
        })
      })
    )

    // Notify each assignee about their new tasks
    const assigneeIds = [...new Set(tasks.map(t => t.assignedUserId))]
    await Promise.all(
      assigneeIds.map(async (assigneeId) => {
        const assigneeTasks = tasks.filter(t => t.assignedUserId === assigneeId)
        const taskTitles = assigneeTasks.map(t => `"${t.title}"`).join(", ")
        
        await prisma.notification.create({
          data: {
            employeeId: assigneeId,
            title: "Nouvelles tâches assignées par IA",
            message: `${assigneeTasks.length} tâche(s) vous a/ont été assignée(s) dans le projet "${project.name}": ${taskTitles}`
          }
        })
      })
    )

    // Update project progress
    const allTasks = await prisma.task.findMany({ where: { projectId } })
    const completedTasks = allTasks.filter(t => t.status === "DONE").length
    const progress = allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0

    await prisma.project.update({
      where: { id: projectId },
      data: { progress }
    })

    return NextResponse.json({
      success: true,
      tasks: createdTasks,
      message: `${createdTasks.length} tâche(s) créée(s) avec succès`
    })

  } catch (error) {
    console.error("Error saving generated tasks:", error)
    return NextResponse.json(
      { error: "Erreur lors de la sauvegarde des tâches" },
      { status: 500 }
    )
  }
}