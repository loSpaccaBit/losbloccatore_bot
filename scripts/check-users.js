const { PrismaClient } = require('@prisma/client');

async function checkUsers() {
  const prisma = new PrismaClient();
  
  try {
    console.log('📊 Checking registered users...\n');
    
    // Get total participants
    const totalUsers = await prisma.contestParticipant.count();
    const activeUsers = await prisma.contestParticipant.count({
      where: { isActive: true }
    });
    
    console.log(`👥 Total participants: ${totalUsers}`);
    console.log(`✅ Active participants: ${activeUsers}`);
    console.log(`❌ Inactive participants: ${totalUsers - activeUsers}\n`);
    
    if (totalUsers === 0) {
      console.log('🚫 No users registered yet!');
      return;
    }
    
    // Get participants with details
    const participants = await prisma.contestParticipant.findMany({
      orderBy: [
        { points: 'desc' },
        { createdAt: 'asc' }
      ],
      take: 20 // Show top 20
    });
    
    console.log('🏆 TOP PARTICIPANTS:');
    console.log('─'.repeat(80));
    console.log('Rank | Points | Name          | TikTok | Referrals | Status   | User ID');
    console.log('─'.repeat(80));
    
    participants.forEach((user, index) => {
      const rank = (index + 1).toString().padStart(4);
      const points = user.points.toString().padStart(6);
      const name = (user.firstName || 'Unknown').substring(0, 12).padEnd(13);
      const tiktok = user.tiktokTaskCompleted ? '✅' : '❌';
      const referrals = user.referralCount.toString().padStart(9);
      const status = user.isActive ? 'Active' : 'Inactive';
      const userId = user.userId.toString().padEnd(12);
      
      console.log(`${rank} | ${points} | ${name} | ${tiktok}     | ${referrals} | ${status.padEnd(8)} | ${userId}`);
    });
    
    // Get recent activity
    const recentActivity = await prisma.userActivity.count({
      where: {
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });
    
    console.log('─'.repeat(80));
    console.log(`📈 Activity in last 24h: ${recentActivity} actions`);
    
    // Get referral stats
    const totalReferrals = await prisma.contestReferral.count();
    const activeReferrals = await prisma.contestReferral.count({
      where: { status: 'ACTIVE' }
    });
    
    console.log(`🔗 Total referrals: ${totalReferrals}`);
    console.log(`✅ Active referrals: ${activeReferrals}`);
    
  } catch (error) {
    console.error('❌ Error checking users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();