import { randomBytes } from "node:crypto";

const key = randomBytes(32);

console.log("APP_DATA_ENCRYPTION_KEY options:");
console.log(`hex:    ${key.toString("hex")}`);
console.log(`base64: ${key.toString("base64")}`);
