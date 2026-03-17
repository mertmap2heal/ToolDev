import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('Registering users...');

    // User 1: mert.caferoglu
    const hash1 = await bcrypt.hash('Mmcf_6378', 10);
    const user1 = await prisma.user.upsert({
        where: { email: 'mert.caferoglu' },
        update: {
            password: hash1,
            role: null
        },
        create: {
            email: 'mert.caferoglu',
            name: 'Mert Caferoglu',
            password: hash1,
            role: null
        }
    });
    console.log('Registered user:', user1.email);

    // User 2: admin (SUPERIOR_ADMIN)
    const hash2 = await bcrypt.hash('password', 10);
    const user2 = await prisma.user.upsert({
        where: { email: 'admin' },
        update: {
            password: hash2,
            role: 'SUPERIOR_ADMIN'
        },
        create: {
            email: 'admin',
            name: 'Superior Admin',
            password: hash2,
            role: 'SUPERIOR_ADMIN'
        }
    });
    console.log('Registered user:', user2.email, 'with role:', user2.role);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
