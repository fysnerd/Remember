// Seed script for testing
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create test user
  const passwordHash = await bcrypt.hash('testpassword123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'test@remember.app' },
    update: {},
    create: {
      email: 'test@remember.app',
      passwordHash,
      name: 'Test User',
      emailVerified: true,
      plan: 'PRO',
      settings: {
        create: {
          newCardsPerDay: 20,
          emailReminders: true,
          dailyReminderTime: '09:00',
          timezone: 'Europe/Paris',
        },
      },
    },
  });

  console.log(`✅ Created user: ${user.email}`);

  // Create tags (global, shared across users)
  const tagNames = ['JavaScript', 'Python', 'Machine Learning', 'Web Dev', 'Productivity', 'Finance', 'Health'];
  const tags = await Promise.all(
    tagNames.map((name) =>
      prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name },
      })
    )
  );

  console.log(`✅ Created ${tags.length} tags`);

  // Sample YouTube content
  const youtubeContent = [
    {
      platform: 'YOUTUBE' as const,
      externalId: 'dQw4w9WgXcQ',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Learn JavaScript in 1 Hour - Full Beginner Course',
      description: 'Complete JavaScript tutorial for beginners. Learn variables, functions, loops, and more.',
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      duration: 3600,
      showName: 'CodeAcademy',
      status: 'READY' as const,
      tags: ['JavaScript', 'Web Dev'],
      transcript: `Welcome to this JavaScript tutorial. Today we'll learn the fundamentals of JavaScript programming.

First, let's talk about variables. In JavaScript, you can declare variables using let, const, or var.
Let is used for variables that might change. Const is for constants that won't change.

Functions are reusable blocks of code. You can define them using the function keyword or arrow functions.
Arrow functions are shorter: const add = (a, b) => a + b;

Loops help you repeat code. The for loop is most common: for (let i = 0; i < 10; i++) { console.log(i); }

Arrays store multiple values: const fruits = ['apple', 'banana', 'orange'];
You can loop through arrays with forEach, map, filter, and reduce.

Objects store key-value pairs: const person = { name: 'John', age: 30 };
Access properties with dot notation: person.name or bracket notation: person['name'].

That covers the basics! Practice these concepts and you'll be writing JavaScript in no time.`,
      quizzes: [
        {
          question: 'Which keyword should you use to declare a variable that will never change?',
          options: ['A) let', 'B) const', 'C) var', 'D) function'],
          correctAnswer: 'B',
          explanation: 'const is used for constants - values that should not be reassigned.',
        },
        {
          question: 'What is the correct syntax for an arrow function that adds two numbers?',
          options: [
            'A) function add(a, b) => a + b',
            'B) const add = (a, b) -> a + b',
            'C) const add = (a, b) => a + b',
            'D) add = (a, b) => a + b',
          ],
          correctAnswer: 'C',
          explanation: 'Arrow functions use => syntax and should be assigned to a const.',
        },
        {
          question: 'How do you access the "name" property of an object called "person"?',
          options: ['A) person->name', 'B) person.name', 'C) person[name]', 'D) person::name'],
          correctAnswer: 'B',
          explanation: 'Dot notation (person.name) or bracket notation (person["name"]) are used to access object properties.',
        },
      ],
    },
    {
      platform: 'YOUTUBE' as const,
      externalId: 'abc123xyz',
      url: 'https://www.youtube.com/watch?v=abc123xyz',
      title: 'Python for Data Science - Complete Tutorial',
      description: 'Learn Python for data analysis with pandas, numpy, and matplotlib.',
      thumbnailUrl: 'https://i.ytimg.com/vi/abc123xyz/maxresdefault.jpg',
      duration: 5400,
      showName: 'Data Science Pro',
      status: 'READY' as const,
      tags: ['Python', 'Machine Learning'],
      transcript: `Welcome to Python for Data Science. In this tutorial, we'll cover the essential libraries.

Pandas is the go-to library for data manipulation. Import it with: import pandas as pd
Create a DataFrame from a dictionary or read from CSV: df = pd.read_csv('data.csv')

NumPy handles numerical operations efficiently. Import with: import numpy as np
Create arrays: arr = np.array([1, 2, 3, 4, 5])
NumPy operations are vectorized, meaning they work on entire arrays at once.

Matplotlib creates visualizations: import matplotlib.pyplot as plt
Create a simple plot: plt.plot(x, y) and display with plt.show()

Data cleaning is crucial. Handle missing values with df.dropna() or df.fillna(value).
Filter data: df[df['column'] > 10] returns rows where column is greater than 10.

Group data with groupby: df.groupby('category').mean() calculates mean per category.

These tools form the foundation of data science in Python. Practice with real datasets!`,
      quizzes: [
        {
          question: 'What is the standard alias for importing pandas?',
          options: ['A) pandas', 'B) pd', 'C) pan', 'D) p'],
          correctAnswer: 'B',
          explanation: 'The convention is to import pandas as pd: import pandas as pd',
        },
        {
          question: 'How do you read a CSV file into a pandas DataFrame?',
          options: [
            'A) pd.load_csv("file.csv")',
            'B) pd.read_csv("file.csv")',
            'C) pd.open_csv("file.csv")',
            'D) pd.csv("file.csv")',
          ],
          correctAnswer: 'B',
          explanation: 'pd.read_csv() is the function to read CSV files into a DataFrame.',
        },
      ],
    },
    {
      platform: 'YOUTUBE' as const,
      externalId: 'productivity101',
      url: 'https://www.youtube.com/watch?v=productivity101',
      title: 'The Science of Productivity - How to Get More Done',
      description: 'Evidence-based productivity techniques backed by research.',
      thumbnailUrl: 'https://i.ytimg.com/vi/productivity101/maxresdefault.jpg',
      duration: 1800,
      showName: 'Better Ideas',
      status: 'READY' as const,
      tags: ['Productivity'],
      transcript: `Let's talk about the science of productivity.

The Pomodoro Technique: Work for 25 minutes, then take a 5-minute break. After 4 pomodoros, take a longer break.
This works because our brains can only focus intensely for short periods.

Deep Work is focused, uninterrupted work on cognitively demanding tasks.
Cal Newport recommends scheduling deep work blocks in your calendar.

The Two-Minute Rule: If a task takes less than 2 minutes, do it now.
This prevents small tasks from piling up and creating mental clutter.

Time blocking: Assign specific hours to specific tasks.
Don't just make a to-do list - schedule when you'll do each task.

Sleep is crucial for productivity. 7-9 hours is optimal for most adults.
Sleep deprivation impairs cognitive function more than we realize.

Exercise boosts productivity by improving focus and energy levels.
Even a 20-minute walk can enhance cognitive performance.

Remember: productivity isn't about doing more - it's about doing what matters.`,
      quizzes: [
        {
          question: 'How long is one Pomodoro work session?',
          options: ['A) 15 minutes', 'B) 25 minutes', 'C) 45 minutes', 'D) 60 minutes'],
          correctAnswer: 'B',
          explanation: 'A standard Pomodoro is 25 minutes of focused work followed by a 5-minute break.',
        },
        {
          question: 'According to the Two-Minute Rule, when should you complete a task immediately?',
          options: [
            'A) If it\'s urgent',
            'B) If it takes less than 2 minutes',
            'C) If your boss asks',
            'D) If it\'s on your priority list',
          ],
          correctAnswer: 'B',
          explanation: 'The Two-Minute Rule states: if a task takes less than 2 minutes, do it now to prevent buildup.',
        },
      ],
    },
  ];

  // Sample Spotify content
  const spotifyContent = [
    {
      platform: 'SPOTIFY' as const,
      externalId: 'spotify123',
      url: 'https://open.spotify.com/episode/spotify123',
      title: 'How to Build Wealth in Your 20s',
      description: 'Financial advice for young professionals starting their wealth-building journey.',
      thumbnailUrl: 'https://i.scdn.co/image/spotify123',
      duration: 2700,
      showName: 'The Money Podcast',
      status: 'READY' as const,
      tags: ['Finance', 'Productivity'],
      transcript: `Welcome to The Money Podcast. Today we're talking about building wealth in your 20s.

First principle: Pay yourself first. Before paying bills, save at least 20% of your income.
Automate this transfer so you don't have to think about it.

Emergency fund: Aim for 3-6 months of expenses in a high-yield savings account.
This protects you from unexpected costs without going into debt.

Compound interest is your superpower. Starting at 25 vs 35 can mean hundreds of thousands more at retirement.
Even small amounts matter - $200/month invested at 7% becomes $525,000 in 40 years.

Avoid lifestyle inflation. When you get a raise, save the difference rather than upgrading your lifestyle.
Your 25-year-old self doesn't need a luxury apartment.

Invest in low-cost index funds. Don't try to beat the market - even professionals fail most of the time.
S&P 500 index funds have historically returned about 10% annually.

Pay off high-interest debt aggressively. Credit card debt at 20% APR is an emergency.
Consider the debt avalanche method: pay minimums on all, then attack the highest interest rate first.`,
      quizzes: [
        {
          question: 'What percentage of income is recommended to save according to "pay yourself first"?',
          options: ['A) 5%', 'B) 10%', 'C) 20%', 'D) 50%'],
          correctAnswer: 'C',
          explanation: 'The episode recommends saving at least 20% of your income before paying other expenses.',
        },
        {
          question: 'How many months of expenses should an emergency fund cover?',
          options: ['A) 1-2 months', 'B) 3-6 months', 'C) 12 months', 'D) 24 months'],
          correctAnswer: 'B',
          explanation: 'An emergency fund should cover 3-6 months of expenses for financial security.',
        },
      ],
    },
    {
      platform: 'SPOTIFY' as const,
      externalId: 'health456',
      url: 'https://open.spotify.com/episode/health456',
      title: 'Sleep Optimization: The Ultimate Guide',
      description: 'Science-backed strategies to improve your sleep quality.',
      thumbnailUrl: 'https://i.scdn.co/image/health456',
      duration: 3200,
      showName: 'The Health Lab',
      status: 'READY' as const,
      tags: ['Health'],
      transcript: `Today on The Health Lab, we're diving deep into sleep optimization.

Sleep architecture: We cycle through light sleep, deep sleep, and REM multiple times per night.
Each cycle is about 90 minutes. Aim for 5-6 complete cycles, which is 7.5-9 hours.

Temperature matters: Your body temperature needs to drop 2-3 degrees to initiate sleep.
Keep your bedroom at 65-68°F (18-20°C) for optimal sleep.

Blue light from screens suppresses melatonin production.
Stop screen use 1-2 hours before bed, or use blue light blocking glasses.

Caffeine has a half-life of 5-6 hours. A coffee at 3pm means half is still in your system at 9pm.
Set a caffeine cutoff time - noon is ideal for most people.

Consistent sleep schedule is key. Wake up at the same time every day, even weekends.
This regulates your circadian rhythm and improves sleep quality.

Don't lie in bed awake. If you can't sleep after 20 minutes, get up and do something relaxing.
This prevents your brain from associating bed with wakefulness.`,
      quizzes: [
        {
          question: 'What is the ideal bedroom temperature for sleep?',
          options: ['A) 60-63°F', 'B) 65-68°F', 'C) 72-75°F', 'D) 78-80°F'],
          correctAnswer: 'B',
          explanation: 'The optimal bedroom temperature for sleep is 65-68°F (18-20°C).',
        },
        {
          question: 'How long is one sleep cycle approximately?',
          options: ['A) 30 minutes', 'B) 60 minutes', 'C) 90 minutes', 'D) 120 minutes'],
          correctAnswer: 'C',
          explanation: 'Each sleep cycle (light → deep → REM) is approximately 90 minutes.',
        },
        {
          question: 'What is the half-life of caffeine?',
          options: ['A) 1-2 hours', 'B) 3-4 hours', 'C) 5-6 hours', 'D) 8-10 hours'],
          correctAnswer: 'C',
          explanation: 'Caffeine has a half-life of 5-6 hours, meaning half remains in your system after that time.',
        },
      ],
    },
  ];

  // Insert content with transcripts and quizzes
  const allContent = [...youtubeContent, ...spotifyContent];

  for (const content of allContent) {
    const { transcript, quizzes, tags: tagNames, ...contentData } = content;

    const created = await prisma.content.upsert({
      where: {
        userId_platform_externalId: {
          userId: user.id,
          platform: contentData.platform,
          externalId: contentData.externalId,
        },
      },
      update: {},
      create: {
        ...contentData,
        userId: user.id,
        capturedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date in last 30 days
        tags: {
          connect: tags.filter((t) => tagNames.includes(t.name)).map((t) => ({ id: t.id })),
        },
      },
    });

    // Add transcript
    await prisma.transcript.upsert({
      where: { contentId: created.id },
      update: {},
      create: {
        contentId: created.id,
        text: transcript,
        language: 'en',
        source: 'YOUTUBE_SUBTITLES',
      },
    });

    // Add quizzes
    for (const quiz of quizzes) {
      await prisma.quiz.create({
        data: {
          contentId: created.id,
          question: quiz.question,
          type: 'MULTIPLE_CHOICE',
          options: quiz.options,
          correctAnswer: quiz.correctAnswer,
          explanation: quiz.explanation,
        },
      });
    }

    console.log(`✅ Created content: ${created.title}`);
  }

  // Create some review cards for spaced repetition
  const contents = await prisma.content.findMany({
    where: { userId: user.id },
    include: { quizzes: true },
  });

  let cardCount = 0;
  for (const content of contents) {
    for (const quiz of content.quizzes) {
      // Create card with varying states
      const repetitions = Math.floor(Math.random() * 5);

      await prisma.card.upsert({
        where: { quizId_userId: { quizId: quiz.id, userId: user.id } },
        update: {},
        create: {
          userId: user.id,
          quizId: quiz.id,
          easeFactor: 2.5 + (Math.random() - 0.5) * 0.4,
          interval: Math.pow(2, repetitions),
          repetitions,
          nextReviewAt: new Date(Date.now() + (Math.random() * 7 - 3) * 24 * 60 * 60 * 1000), // -3 to +4 days from now
        },
      });
      cardCount++;
    }
  }

  console.log(`✅ Created ${cardCount} review cards`);

  // Create some review history for streak tracking
  const cards = await prisma.card.findMany({
    where: { userId: user.id },
    take: 5,
  });

  for (let i = 0; i < 7; i++) {
    // 80% chance of having reviewed on each day (for realistic streak)
    if (Math.random() < 0.8 || i === 0) {
      const reviewDate = new Date();
      reviewDate.setDate(reviewDate.getDate() - i);
      reviewDate.setHours(10, 0, 0, 0);

      // Create a few reviews for that day
      const numReviews = Math.floor(Math.random() * 5) + 2;
      for (let j = 0; j < numReviews && j < cards.length; j++) {
        await prisma.review.create({
          data: {
            userId: user.id,
            cardId: cards[j].id,
            rating: ['AGAIN', 'HARD', 'GOOD', 'EASY'][Math.floor(Math.random() * 4)] as 'AGAIN' | 'HARD' | 'GOOD' | 'EASY',
            responseTime: Math.floor(Math.random() * 10000) + 2000,
            createdAt: reviewDate,
          },
        });
      }
    }
  }

  console.log('✅ Created review history for streak');

  console.log('\n🎉 Seeding complete!');
  console.log('\n📧 Test account:');
  console.log('   Email: test@remember.app');
  console.log('   Password: testpassword123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
