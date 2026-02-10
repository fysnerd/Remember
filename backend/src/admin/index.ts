import AdminJS, { ComponentLoader } from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import { Database, Resource } from '@adminjs/prisma';
import session from 'express-session';
import Connect from 'connect-pg-simple';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { resources } from './resources.js';
import { dashboardHandler } from './dashboard.handler.js';
import { sseHandler } from './dashboard.sse.js';
import { logsSseHandler } from './logs.sse.js';
import { startTailing } from './logs.tailer.js';

const log = logger.child({ component: 'admin' });

AdminJS.registerAdapter({ Database, Resource });

export function setupAdminJS() {
  const componentLoader = new ComponentLoader();
  const Components = {
    Dashboard: componentLoader.add('Dashboard', './components/dashboard'),
    LogViewer: componentLoader.add('LogViewer', './components/logs'),
  };

  const admin = new AdminJS({
    resources,
    rootPath: '/admin',
    dashboard: {
      component: Components.Dashboard,
      handler: dashboardHandler,
    },
    componentLoader,
    pages: {
      logs: {
        component: Components.LogViewer,
        icon: 'Terminal',
      },
    },
    branding: {
      companyName: 'Ankora Admin',
      withMadeWithLove: false,
    },
  });

  const ConnectSession = Connect(session);
  const sessionStore = new ConnectSession({
    conObject: { connectionString: config.database.url },
    tableName: 'admin_sessions',
    createTableIfMissing: true,
  });

  const authenticate = async (email: string, password: string) => {
    if (email === config.admin.email && password === config.admin.password) {
      log.info({ email }, 'Admin login successful');
      return { email, id: 'admin' };
    }
    log.warn({ email }, 'Admin login failed');
    return null;
  };

  const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    {
      authenticate,
      cookieName: 'adminjs',
      cookiePassword: config.jwt.secret,
    },
    null,
    {
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      secret: config.jwt.secret,
      cookie: {
        httpOnly: true,
        secure: config.isProduction,
      },
      name: 'adminjs',
    }
  );

  // Mount SSE endpoints with session auth (inherits session middleware from adminRouter)
  adminRouter.get('/api/sse', sseHandler);
  adminRouter.get('/api/logs-sse', logsSseHandler);

  // Start log file tailing
  startTailing();

  log.info({ rootPath: '/admin' }, 'AdminJS panel initialized');
  return { admin, adminRouter };
}
