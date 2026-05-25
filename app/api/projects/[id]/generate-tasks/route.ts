import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"
import Groq from "groq-sdk"

interface TeamSkill {
  level: number
  skill: { name: string }
}

interface TeamLeaveRequest {
  startDate: Date | null
  endDate: Date | null
}

interface ProcessedTeamMember {
  id: string
  name: string
  jobTitle: string
  status: "active" | "en_conge"
  skills: Array<{ name: string; level: number }>
}

interface PreviewTask {
  title: string
  description: string
  assignedUserId: string
  dueDate: string
  priority: "HIGH" | "MEDIUM" | "LOW"
  comment: string | null
}

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

    // Get the project with team members, their skills, and leave status
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            position: true,
            role: true,
            skills: {
              select: {
                level: true,
                skill: {
                  select: {
                    name: true
                  }
                }
              }
            },
            requests: {
              where: { type: "CONGE", status: "APPROUVE" },
              select: { startDate: true, endDate: true }
            }
          }
        },
        tasks: {
          select: {
            title: true,
            status: true
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
    const teamIds = teamMembers.map((e: { id: string }) => e.id)
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

    // Determine project phase
    const progress = project.progress ?? 0
    const phase = progress < 30 ? 'foundation (setup, architecture, core models)' : progress < 70 ? 'mid (features, integrations, UI)' : 'late (testing, bug fixes, optimization, deployment)'

    // Process team members with status
    const today = new Date()
    const processedTeamMembers: ProcessedTeamMember[] = project.team.map((m) => {
      const isOnLeave = m.requests.some((req: TeamLeaveRequest) => {
        const start = req.startDate ? new Date(req.startDate) : null
        const end = req.endDate ? new Date(req.endDate) : null
        if (!start || !end) return false
        return today >= start && today <= end
      })
      const status = isOnLeave ? 'en_conge' : 'active'
      return {
        id: m.id,
        name: m.name,
        jobTitle: m.position || m.role,
        status,
        skills: m.skills.map((s: TeamSkill) => ({ name: s.skill.name, level: s.level })) || []
      }
    })

    const unavailableMembers = processedTeamMembers.filter((m) => m.status === 'en_conge')
    const activeMembers = processedTeamMembers.filter((m) => m.status === 'active')
    const maxPerPerson = Math.ceil(Math.min(processedTeamMembers.length * 2, 10) * 0.4)
    const totalTasks = Math.min(processedTeamMembers.length * 2, 10)

    const systemPrompt = `You are a project task assignment engine. Return ONLY a valid JSON array, no markdown, no explanation, no code blocks.

STRICT RULES:
1. NEVER repeat or rephrase existing tasks — read them carefully
2. ALL members must receive at least 1 task — no member left without work
3. Max tasks per person: ${maxPerPerson} (strict cap, never exceed this for any single member)
4. SKILL MATCHING: for each task, find the best skill match. If that member is ACTIVE → assign to them. If that member is "en_conge" → assign to the NEXT best match instead, set comment to "Better fit: [unavailable member name] ([skill] level [X]/5) but they are currently on leave"
5. If NO suitable active member exists, assign to least busy member and note it in comment
6. Each generation must approach from a DIFFERENT angle — if existing tasks cover backend, focus new tasks on frontend, testing, docs, DevOps, etc.
7. Use project phase strictly — do not generate tasks irrelevant to current phase`

    const userPrompt = `Project: ${project.name}
Description: ${project.description}
Start: ${project.startDate ? new Date(project.startDate).toISOString() : 'Non définie'} | End: ${project.endDate ? new Date(project.endDate).toISOString() : 'Non définie'}
Progress: ${progress}% — Phase: ${phase}

EXISTING TASKS — DO NOT repeat or rephrase any:
${project.tasks.map(t => `- [${t.status}] ${t.title}`).join('\n') || 'none yet'}

ACTIVE members (assign tasks to these people):
${activeMembers.map((m) => `- id: ${m.id} | name: ${m.name} | title: ${m.jobTitle} | skills: ${m.skills?.map((s) => `${s.name}(${s.level}/5)`).join(', ') || 'general'}`).join('\n')}

UNAVAILABLE members (do NOT assign to these — reference them in comments only):
${unavailableMembers.map((m) => `- name: ${m.name} | skills: ${m.skills?.map((s) => `${s.name}(${s.level}/5)`).join(', ') || 'general'} | status: ${m.status}`).join('\n') || 'none'}

Generate exactly ${totalTasks} tasks. Max ${maxPerPerson} tasks per person. Every active member must get at least 1 task.

Return ONLY this JSON array:
[
  {
    "title": string,
    "description": string,
    "assignedUserId": string (ONLY from active member ids above),
    "dueDate": string (ISO between ${project.startDate ? new Date(project.startDate).toISOString() : '2024-01-01T00:00:00.000Z'} and ${project.endDate ? new Date(project.endDate).toISOString() : '2024-12-31T23:59:59.999Z'}),
    "priority": "HIGH" | "MEDIUM" | "LOW",
    "comment": string | null
  }
]`

    // Call Groq API
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
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
    let generatedTasks: PreviewTask[]
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
      if (!task.title || !task.description || !task.assignedUserId || !task.dueDate || !task.priority) {
        return NextResponse.json(
          { error: "Les tâches générées sont incomplètes" },
          { status: 422 }
        )
      }

      // Verify assignedUserId exists in active team
      const validUser = activeMembers.find((m) => m.id === task.assignedUserId)
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
      teamMembers: activeMembers
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
    const teamIds = teamMembers.map((e: { id: string }) => e.id)
    const isAuthorized = 
      project.createdById === user.id ||
      project.managerId === user.id ||
      project.team.some((member: { id: string }) => teamIds.includes(member.id))
    if (!isAuthorized) {
      return NextResponse.json({ error: "Accès refusé à ce projet" }, { status: 403 })
    }

    // Create all tasks
    const createdTasks = await Promise.all(
      tasks.map(async (task: PreviewTask) => {
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
    const assigneeIds = [...new Set(tasks.map((t: PreviewTask) => t.assignedUserId))]
    await Promise.all(
      assigneeIds.map(async (assigneeId) => {
        const assigneeTasks = tasks.filter((t: PreviewTask) => t.assignedUserId === assigneeId)
        const taskTitles = assigneeTasks.map((t: PreviewTask) => `"${t.title}"`).join(", ")
        
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
    const completedTasks = allTasks.filter((t: { status: string }) => t.status === "DONE").length
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
