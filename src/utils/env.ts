export function useFixtures(): boolean {
  return process.env.MODELROUTER_USE_FIXTURES === "1";
}
