const leaderboardScheduler = require('../dist/services/LeaderboardSchedulerService').default;

console.log('🧪 Testing node-cron functionality...');

// Show current status
console.log('📊 Current scheduler status:');
console.log(leaderboardScheduler.getStatus());

// Test cron with a simple job every minute for 5 minutes
console.log('\n⏰ Starting test cron job (every minute for 5 minutes)...');
leaderboardScheduler.startTestSchedule();

console.log('\n✅ Test started! Check logs for cron job execution...');
console.log('📝 You should see "Test cron job executed" messages every minute.');
console.log('🔍 Monitor with: tail -f logs/combined-$(date +%Y-%m-%d).log | grep "Test cron"');

// Keep process alive for testing
setTimeout(() => {
  console.log('\n🏁 Test completed. Check logs to verify cron is working.');
  process.exit(0);
}, 6 * 60 * 1000); // 6 minutes