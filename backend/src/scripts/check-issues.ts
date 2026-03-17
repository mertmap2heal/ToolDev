import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkIssues() {
  try {
    const issues = await prisma.issue.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        issueKey: true,
        title: true,
        status: true,
        priority: true,
      },
    })

    console.log(`\n📊 Found ${issues.length} issues in database:\n`)
    
    if (issues.length === 0) {
      console.log('❌ No issues found!')
    } else {
      issues.forEach((issue, idx) => {
        console.log(`${idx + 1}. ${issue.issueKey || 'NO-KEY'} - ${issue.title}`)
        console.log(`   Status: ${issue.status}, Priority: ${issue.priority}\n`)
      })
    }
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkIssues()
