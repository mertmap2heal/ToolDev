import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { email: { contains: 'mert.caferoglu' } },
                { name: { contains: 'mert.caferoglu' } }
            ]
        }
    });
    console.log('Found user:', user);

    const allUsers = await prisma.user.findMany();
    console.log('All users in DB:', allUsers.length);
}

main().finally(() => prisma.$disconnect())
