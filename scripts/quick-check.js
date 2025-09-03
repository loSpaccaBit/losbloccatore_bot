const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    const count = await prisma.contestParticipant.count();
    console.log(count === 0 ? '🚫 No users registered' : `✅ ${count} users registered`);
  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();