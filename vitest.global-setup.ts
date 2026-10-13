/** Runs once before the tests: they read local times, so every machine has to be in the same zone. */
export function setup() {
  process.env.TZ = 'Asia/Kolkata';
}
