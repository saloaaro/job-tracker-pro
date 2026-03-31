import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { authMiddleware } from "./middleware/auth.js";

dotenv.config();

// =====================
// 🔌 PRISMA (Prisma 7 adapter)
// =====================
import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // 🔥 TÄRKEIN FIX
  },
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

// =====================
// 🚀 EXPRESS APP
// =====================
const app = express();

app.use(cors());
app.use(express.json());

// =====================
// 🚀 TEST ROUTE
// =====================
app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

// =====================
// 🔐 REGISTER
// =====================
app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    res.json({ message: "User created", user });
  } catch (error) {
    console.error(error);

    if (error.code === "P2002") {
      return res.status(400).json({ error: "Email already exists" });
    }

    res.status(500).json({ error: "Something went wrong" });
  }
});

// =====================
// 🔐 LOGIN
// =====================
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Login failed" });
  }
});

// =====================
// 👤 CURRENT USER
// =====================
app.get("/me", authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
  });

  res.json(user);
});

// =====================
// 👥 TEST USERS
// =====================
app.get("/users", async (req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

// =====================
// 💼 JOB ROUTES
// =====================

// GET jobs
app.get("/jobs", authMiddleware, async (req, res) => {
  const jobs = await prisma.job.findMany({
    where: {
      userId: req.user.userId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  res.json(jobs);
});

// CREATE job
app.post("/jobs", authMiddleware, async (req, res) => {
  try {
    const { title, company, status, salary } = req.body;

    const job = await prisma.job.create({
      data: {
        title,
        company,
        status,
        salary,
        userId: req.user.userId,
      },
    });

    res.json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create job" });
  }
});

// UPDATE job
app.put("/jobs/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { title, company, status, salary } = req.body;

  try {
    const job = await prisma.job.update({
      where: {
        id: Number(id),
      },
      data: {
        title,
        company,
        status,
        salary,
      },
    });

    res.json(job);
  } catch (error) {
    res.status(500).json({ error: "Update failed" });
  }
});

// DELETE job
app.delete("/jobs/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.job.delete({
      where: {
        id: Number(id),
      },
    });

    res.json({ message: "Job deleted" });
  } catch (error) {
    res.status(500).json({ error: "Delete failed" });
  }
});

// =====================
// 🚀 START SERVER
// =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
