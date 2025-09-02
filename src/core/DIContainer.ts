/**
 * Dependency Injection Container
 * Manages service instances and their dependencies
 */

import { TelegramService } from '../services/TelegramService';
import { UserActivityService } from '../services/UserActivityService';
import { ContestService } from '../services/ContestService';
import messageService from '../services/MessageService';
import leaderboardScheduler from '../services/LeaderboardSchedulerService';

export interface ServiceContainer {
  telegramService: TelegramService;
  userActivityService: UserActivityService;
  contestService: ContestService;
  messageService: typeof messageService;
  leaderboardScheduler: typeof leaderboardScheduler;
}

export class DIContainer {
  private static instance: DIContainer;
  private services: Partial<ServiceContainer> = {};
  private initialized = false;

  private constructor() {}

  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  /**
   * Initialize all services with their dependencies
   */
  initialize(): ServiceContainer {
    if (this.initialized) {
      return this.services as ServiceContainer;
    }

    // Initialize core services
    this.services.telegramService = new TelegramService();
    this.services.userActivityService = new UserActivityService();
    this.services.contestService = new ContestService();
    this.services.messageService = messageService;
    this.services.leaderboardScheduler = leaderboardScheduler;

    this.initialized = true;
    return this.services as ServiceContainer;
  }

  /**
   * Get all services
   */
  getServices(): ServiceContainer {
    if (!this.initialized) {
      throw new Error('DIContainer must be initialized before getting services');
    }
    return this.services as ServiceContainer;
  }

  /**
   * Get a specific service by name
   */
  getService<K extends keyof ServiceContainer>(serviceName: K): ServiceContainer[K] {
    const services = this.getServices();
    return services[serviceName];
  }

  /**
   * Clear all services (mainly for testing)
   */
  clear(): void {
    this.services = {};
    this.initialized = false;
  }
}

export default DIContainer.getInstance();