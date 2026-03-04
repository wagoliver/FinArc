import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const hashedPassword = await bcrypt.hash("FinArc@2026", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@finarc.local" },
    update: {},
    create: {
      name: "Administrador",
      email: "admin@finarc.local",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  console.log("✓ Admin user created:", admin.email);

  // Create default cost categories
  const categories = [
    {
      name: "Workload",
      slug: "workload",
      color: "#8b5cf6",
      icon: "Server",
    },
    {
      name: "Pessoas",
      slug: "pessoas",
      color: "#3b82f6",
      icon: "Users",
    },
    {
      name: "Software",
      slug: "software",
      color: "#06b6d4",
      icon: "Package",
    },
    {
      name: "Outros",
      slug: "outros",
      color: "#ec4899",
      icon: "MoreHorizontal",
    },
  ];

  for (const cat of categories) {
    await prisma.costCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  console.log("✓ Default categories created:", categories.length);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
