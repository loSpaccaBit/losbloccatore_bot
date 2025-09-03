const { PrismaClient } = require('@prisma/client');

async function clearDatabase() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🗑️  Clearing production database...');
    
    // Clear in order to respect foreign key constraints
    console.log('📋 Clearing ContestReferral records...');
    const referrals = await prisma.contestReferral.deleteMany({});
    console.log(`✅ Deleted ${referrals.count} referral records`);
    
    console.log('🎯 Clearing ContestParticipant records...');
    const participants = await prisma.contestParticipant.deleteMany({});
    console.log(`✅ Deleted ${participants.count} participant records`);
    
    console.log('📊 Clearing UserActivity records...');
    const activities = await prisma.userActivity.deleteMany({});
    console.log(`✅ Deleted ${activities.count} activity records`);
    
    console.log('🎉 Database cleared successfully!');
    console.log('');
    console.log('⚠️  Remember to:');
    console.log('   1. Update TikTok URL if needed');
    console.log('   2. Restart the bot');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Require confirmation in production
if (process.env.NODE_ENV === 'production') {
  console.log('⚠️  WARNING: This will delete ALL data in production!');
  console.log('Type "CONFIRM DELETE" to proceed:');
  
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  
  process.stdin.on('data', function (text) {
    if (text.trim() === 'CONFIRM DELETE') {
      clearDatabase();
    } else {
      console.log('❌ Operation cancelled');
      process.exit(0);
    }
  });
} else {
  clearDatabase();
}