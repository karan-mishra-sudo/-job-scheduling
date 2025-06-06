const express = require('express');
const { CronJob } = require('cron');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

const OUTPUT_FILE = 'output.log';

const jobs = {};

async function executeJob(jobId, jobName) {
  const message = `Job "${jobName}" (${jobId}) executed at ${new Date().toISOString()}: Hello World\n`;
  console.log(message.trim());
  await fs.appendFile(OUTPUT_FILE, message);
}

function getCronExpression(schedule) {
  const { type, minute, hour, dayOfWeek } = schedule;

  switch (type.toLowerCase()) {
    case 'hourly':
      if (minute < 0 || minute > 59) throw new Error('Invalid minute');
      return `${minute} * * * *`;
    case 'daily':
      if (minute < 0 || minute > 59 || hour < 0 || hour > 23) throw new Error('Invalid time');
      return `${minute} ${hour} * * *`;
    case 'weekly':
      if (minute < 0 || minute > 59 || hour < 0 || hour > 23 || dayOfWeek < 0 || dayOfWeek > 6) {
        throw new Error('Invalid time or day of week');
      }
      return `${minute} ${hour} * * ${dayOfWeek}`;
    default:
      throw new Error('Invalid schedule type');
  }
}

app.post('/jobs', async (req, res) => {
  try {
    const { name, schedule } = req.body;
    if (!name || !schedule || !schedule.type) {
      return res.status(400).json({ error: 'Name and schedule are required' });
    }

    const jobId = uuidv4();
    const cronExpression = getCronExpression(schedule);

    const task = new CronJob(cronExpression, () => executeJob(jobId, name));

    jobs[jobId] = { name, schedule, task };

    task.start();

    res.status(201).json({ jobId, name, schedule });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/jobs', (req, res) => {
  const jobList = Object.entries(jobs).map(([jobId, { name, schedule }]) => ({
    jobId,
    name,
    schedule,
  }));
  res.json(jobList);
});

app.delete('/jobs/:jobId', (req, res) => {
  const { jobId } = req.params;
  if (!jobs[jobId]) {
    return res.status(404).json({ error: 'Job not found' });
  }

  jobs[jobId].task.stop();
  delete jobs[jobId];
  res.json({ message: 'Job deleted' });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

async function init() {
  try {
    await fs.writeFile(OUTPUT_FILE, '');
  } catch (error) {
    console.error('Error initializing output file:', error);
  }
}
init();
