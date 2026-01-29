import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.content.count({ where: { platform: 'SPOTIFY' } });
  console.log('Spotify episodes in DB:', count);

  const episodes = await prisma.content.findMany({
    where: { platform: 'SPOTIFY' },
    select: { title: true, showName: true },
    take: 10
  });

  episodes.forEach(e => console.log('-', e.showName + ':', e.title?.substring(0, 50)));

  await prisma.$disconnect();
}

main();
