import { storage } from "./storage";
import { hashPassword } from "./auth"; // We can't import specific function from auth easily if it's not exported well, let's just re-hash or make seed simple
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function mockHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function seedDatabase() {
  const existingUsers = await storage.getUserByEmail("curator@adapt.com");
  if (existingUsers) return;

  const curatorPass = await mockHash("curator123");
  const employeePass = await mockHash("employee123");

  const curator = await storage.createUser({
    email: "curator@adapt.com",
    password: curatorPass,
    name: "Jane Curator",
    role: "curator"
  });

  const employee = await storage.createUser({
    email: "employee@adapt.com",
    password: employeePass,
    name: "John Employee",
    role: "employee"
  });

  // Create a Demo Track
  const track = await storage.createTrack({
    curatorId: curator.id,
    title: "Customer Empathy 101",
    rawKnowledgeBase: "Listen, Acknowledge, Solve.",
    joinCode: "123456"
  });

  await storage.createSteps([
    {
      trackId: track.id,
      type: "content",
      content: { text: "Empathy is about understanding the customer's feelings." },
      orderIndex: 0
    },
    {
      trackId: track.id,
      type: "quiz",
      content: { 
        question: "What comes first?", 
        options: ["Solving the problem", "Acknowledging feelings", "Listening"], 
        correctIndex: 2 
      },
      orderIndex: 1
    },
    {
      trackId: track.id,
      type: "roleplay",
      content: { 
        scenario: "Client says: 'I am so frustrated!'", 
        ideal_answer: "I understand your frustration."
      },
      orderIndex: 2
    }
  ]);
  
  console.log("Database seeded!");
}
