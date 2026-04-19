/**
 * Script to migrate existing issues to have structured issueKey format
 * Run with: npx tsx src/scripts/migrate-issue-keys.ts
 */

import { prisma } from '../lib/prisma'


async function migrateIssueKeys() {
  try {
    console.log('🔍 Finding all issues...')

    // Find all issues (regardless of whether they have issueKey)
    const allIssues = await prisma.issue.findMany({
      orderBy: {
        createdAt: 'asc', // Assign keys in creation order
      },
      select: {
        id: true,
        projectId: true,
        title: true,
        createdAt: true,
      },
    })

    console.log(`📊 Found ${allIssues.length} issues to migrate`)

    if (allIssues.length === 0) {
      console.log('✅ No issues to migrate!')
      return
    }

    console.log(`🔢 Starting from ISS-0001`)

    // Update each issue
    console.log('⚙️  Assigning issue keys...')
    let counter = 1
    for (const issue of allIssues) {
      const issueKey = `ISS-${String(counter).padStart(4, '0')}`
      
      await prisma.issue.update({
        where: { id: issue.id },
        data: { issueKey },
      })

      console.log(`  ✓ ${issueKey} → ${issue.title.substring(0, 50)}${issue.title.length > 50 ? '...' : ''}`)
      counter++
    }

    console.log(`\n✅ Successfully migrated ${allIssues.length} issues!`)
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the migration
migrateIssueKeys()
  .then(() => {
    console.log('\n✨ Migration complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Migration error:', error)
    process.exit(1)
  })
