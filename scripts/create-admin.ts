/**
 * Creates the first administrator, or promotes an existing account.
 *
 *   pnpm admin:create                 # prompts for email, name and password
 *   ADMIN_EMAIL=… ADMIN_PASSWORD=… pnpm admin:create   # non-interactive (CI, e2e)
 *
 * The password is never stored in the repository, a seed or shell history
 * (unless you pass it in the environment yourself). It is hashed by better-auth.
 */
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { auth } from "../src/server/auth";
import { db } from "../src/server/db";
import { passwordSchema } from "../src/lib/validation/auth";

async function promptHidden(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput.bind(rl);
  let muted = false;
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
    if (!muted) write(s);
  };
  const answerPromise = rl.question(question);
  muted = true;
  const answer = await answerPromise;
  rl.close();
  stdout.write("\n");
  return answer;
}

async function main() {
  let email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  let name = process.env.ADMIN_NAME?.trim() || "Administrator";
  let password = process.env.ADMIN_PASSWORD;

  if (!email) {
    const rl = createInterface({ input: stdin, output: stdout });
    email = (await rl.question("Admin email: ")).trim().toLowerCase();
    name = (await rl.question("Name [Administrator]: ")).trim() || "Administrator";
    rl.close();
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("That doesn't look like an email address.");

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    await db.user.update({ where: { id: existing.id }, data: { role: "ADMIN" } });
    console.log(`Promoted existing account ${email} to admin. Its password is unchanged.`);
    return;
  }

  if (!password) {
    password = await promptHidden("Password (10+ characters, hidden): ");
    const again = await promptHidden("Repeat password: ");
    if (password !== again) throw new Error("Passwords don't match.");
  }
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) throw new Error(parsed.error.issues[0]!.message);

  const { user } = await auth.api.signUpEmail({ body: { email, name, password: parsed.data } });
  await db.user.update({ where: { id: user.id }, data: { role: "ADMIN", emailVerified: true } });
  console.log(`Created admin ${email}.`);
}

main()
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
