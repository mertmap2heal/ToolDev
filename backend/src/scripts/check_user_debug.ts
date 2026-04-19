
import { prisma } from '../lib/prisma'


async function main() {
    const email = 'mert.caferoglu' // Based on the screenshot username
    // The login controller uses email to find the user.
    // The screenshot shows "mert.caferoglu" as username.
    // If the system uses email as username, then we check for email "mert.caferoglu".
    // But wait, the schema has 'email' and 'name'.
    // The login controller does: const { email, password } = req.body; ... where: { email }
    // So the "Username" field in the UI is actually sending "email".

    // Let's check if there is a user with email "mert.caferoglu" (it might be missing @domain.com)
    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { email: email },
                { email: { startsWith: email } },
                { name: email }
            ]
        }
    })

    console.log('User found:', user)

    if (user) {
        console.log('User password hash:', user.password.substring(0, 10) + '...')
    } else {
        console.log('No user found matching:', email)
    }

    // Also list all users to see what's in there
    const allUsers = await prisma.user.findMany({ select: { email: true, name: true, role: true } })
    console.log('All users:', allUsers)
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
