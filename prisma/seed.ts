import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash("password123", 10)

  const rh = await prisma.employee.create({
    data: {
      name: "Marie Dupont",
      email: "rh@demo.com",
      password: hashedPassword,
      role: "RH",
      department: "RH"
    }
  })

  const chef1 = await prisma.employee.create({
    data: {
      name: "Sophie Bernard",
      email: "chef@demo.com",
      password: hashedPassword,
      role: "CHEF",
      department: "Engineering"
    }
  })

  const chef2 = await prisma.employee.create({
    data: {
      name: "Karim Mansouri",
      email: "chef2@demo.com",
      password: hashedPassword,
      role: "CHEF",
      department: "Design"
    }
  })

  await prisma.employee.createMany({
    data: [
      {
        name: "Thomas Martin",
        email: "collab1@demo.com",
        password: hashedPassword,
        role: "COLLABORATEUR",
        managerId: chef1.id,
        department: "Engineering"
      },
      {
        name: "Leila Hamdi",
        email: "collab2@demo.com",
        password: hashedPassword,
        role: "COLLABORATEUR",
        managerId: chef1.id,
        department: "Engineering"
      },
      {
        name: "Amine Trabelsi",
        email: "collab3@demo.com",
        password: hashedPassword,
        role: "COLLABORATEUR",
        managerId: chef2.id,
        department: "Design"
      }
    ]
  })

  console.log("Seed complete. Demo accounts:")
<<<<<<< HEAD
  console.log("RH:           rh@demo.com / password123") //sb5xvnujYLWY
=======
  console.log("RH:           rh@demo.com / password123")
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2
  console.log("Chef 1:       chef@demo.com / password123")
  console.log("Chef 2:       chef2@demo.com / password123")
  console.log("Collaborateur: collab1@demo.com / password123")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
