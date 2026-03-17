/**
 * Script to check database state and reassign projects to current user
 * Run with: npx tsx src/scripts/check-and-fix-projects.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking database state...\n')

  // Get all users
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  })

  console.log(`📊 Found ${users.length} user(s):`)
  users.forEach((user) => {
    console.log(`  - ${user.email} (${user.name}) - ID: ${user.id}`)
  })

  // Get all projects
  const allProjects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      userId: true,
      createdAt: true,
      teamMembers: {
        select: {
          userId: true,
        },
      },
    },
  })

  console.log(`\n📊 Found ${allProjects.length} project(s):`)
  allProjects.forEach((project) => {
    const owner = users.find((u) => u.id === project.userId)
    console.log(`  - ${project.name} - Owner: ${owner?.email || 'Unknown'} (${project.userId})`)
  })

  // Find the dev@example.com user
  const devUser = users.find((u) => u.email === 'dev@example.com')

  if (!devUser) {
    console.log('\n❌ dev@example.com user not found!')
    console.log('   The auto-auth system will create this user on first login.')
    return
  }

  console.log(`\n✅ Found dev@example.com user: ${devUser.id}`)

  // Check if dev user has any projects
  const devProjects = allProjects.filter((p) => p.userId === devUser.id)
  console.log(`\n📊 dev@example.com has ${devProjects.length} project(s)`)

  if (devProjects.length === 0 && allProjects.length > 0) {
    console.log('\n⚠️  Projects exist but belong to other users.')
    console.log('   Would you like to reassign all projects to dev@example.com?')
    console.log('   (This will update the userId field for all projects)')
    
    // For now, let's just show what would happen
    console.log('\n💡 To reassign projects, uncomment the code below and run again:')
    console.log(`
    // Reassign all projects to dev user
    await prisma.project.updateMany({
      where: {},
      data: {
        userId: devUser.id,
      },
    })
    console.log('✅ All projects reassigned to dev@example.com')
    `)
  } else if (devProjects.length > 0) {
    console.log('\n✅ Projects found for dev@example.com:')
    devProjects.forEach((p) => {
      console.log(`  - ${p.name}`)
    })
  } else {
    console.log('\n📝 No projects exist in the database yet.')
    console.log('   Create a project through the UI to get started.')
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
