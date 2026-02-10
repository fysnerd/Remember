import { getModelByName } from '@adminjs/prisma';
import { prisma } from '../config/database.js';
import { jobTriggerActions } from './actions.js';

const nav = {
  users:      { name: 'Users',      icon: 'User' },
  content:    { name: 'Content',    icon: 'Document' },
  learning:   { name: 'Learning',   icon: 'Education' },
  platform:   { name: 'Platform',   icon: 'Connect' },
  monitoring: { name: 'Monitoring', icon: 'Activity' },
};

export const resources = [
  // === Users ===
  {
    resource: { model: getModelByName('User'), client: prisma },
    options: {
      navigation: nav.users,
      listProperties: ['id', 'email', 'name', 'plan', 'createdAt'],
      sort: { sortBy: 'createdAt', direction: 'desc' as const },
    },
  },
  {
    resource: { model: getModelByName('UserSettings'), client: prisma },
    options: { navigation: nav.users },
  },
  {
    resource: { model: getModelByName('OAuthAccount'), client: prisma },
    options: { navigation: nav.users },
  },

  // === Content ===
  {
    resource: { model: getModelByName('Content'), client: prisma },
    options: {
      navigation: nav.content,
      listProperties: ['id', 'title', 'platform', 'status', 'userId', 'createdAt'],
      sort: { sortBy: 'createdAt', direction: 'desc' as const },
    },
  },
  {
    resource: { model: getModelByName('Transcript'), client: prisma },
    options: { navigation: nav.content },
  },
  {
    resource: { model: getModelByName('TranscriptCache'), client: prisma },
    options: { navigation: nav.content },
  },
  {
    resource: { model: getModelByName('Tag'), client: prisma },
    options: { navigation: nav.content },
  },

  // === Learning ===
  {
    resource: { model: getModelByName('Quiz'), client: prisma },
    options: { navigation: nav.learning },
  },
  {
    resource: { model: getModelByName('Card'), client: prisma },
    options: { navigation: nav.learning },
  },
  {
    resource: { model: getModelByName('Review'), client: prisma },
    options: {
      navigation: nav.learning,
      sort: { sortBy: 'createdAt', direction: 'desc' as const },
    },
  },
  {
    resource: { model: getModelByName('QuizSession'), client: prisma },
    options: { navigation: nav.learning },
  },
  {
    resource: { model: getModelByName('Streak'), client: prisma },
    options: { navigation: nav.learning },
  },

  // === Platform ===
  {
    resource: { model: getModelByName('ConnectedPlatform'), client: prisma },
    options: { navigation: nav.platform },
  },

  // === Monitoring ===
  {
    resource: { model: getModelByName('JobExecution'), client: prisma },
    options: {
      navigation: nav.monitoring,
      listProperties: ['id', 'jobName', 'status', 'triggerSource', 'startedAt', 'duration'],
      sort: { sortBy: 'startedAt', direction: 'desc' as const },
      actions: {
        ...jobTriggerActions,
      },
    },
  },
];
