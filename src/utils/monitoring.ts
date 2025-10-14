/**
 * Advanced monitoring and metrics collection for Mono operations
 * Provides comprehensive performance tracking, health monitoring, and analytics
 */

import { Logger } from "./log";

/**
 * Performance metrics collector
 */
export class PerformanceMetrics {
  private metrics: Map<string, MetricEntry[]> = new Map();
  private maxEntries: number = 1000;

  /**
   * Record a metric entry
   */
  record(name: string, value: number, unit: string = 'ms', metadata?: Record<string, any>): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const entries = this.metrics.get(name)!;
    entries.push({
      timestamp: Date.now(),
      value,
      unit,
      metadata: metadata || {}
    });

    // Trim old entries if we exceed max
    if (entries.length > this.maxEntries) {
      entries.splice(0, entries.length - this.maxEntries);
    }
  }

  /**
   * Get statistics for a metric
   */
  getStats(name: string, timeWindow?: number): MetricStats | null {
    const entries = this.metrics.get(name);
    if (!entries || entries.length === 0) {
      return null;
    }

    let filteredEntries = entries;
    if (timeWindow) {
      const cutoff = Date.now() - timeWindow;
      filteredEntries = entries.filter(e => e.timestamp >= cutoff);
    }

    if (filteredEntries.length === 0) {
      return null;
    }

    const values = filteredEntries.map(e => e.value);
    const sorted = [...values].sort((a, b) => a - b);

    return {
      count: filteredEntries.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: values.reduce((sum, val) => sum + val, 0) / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      unit: filteredEntries[0].unit,
      timeRange: {
        start: Math.min(...filteredEntries.map(e => e.timestamp)),
        end: Math.max(...filteredEntries.map(e => e.timestamp))
      }
    };
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Clear metrics for a specific name or all metrics
   */
  clear(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }

  /**
   * Export metrics as JSON
   */
  export(): Record<string, MetricEntry[]> {
    const result: Record<string, MetricEntry[]> = {};
    for (const [name, entries] of this.metrics.entries()) {
      result[name] = [...entries];
    }
    return result;
  }
}

/**
 * Health monitoring system
 */
export class HealthMonitor {
  private checks: Map<string, HealthCheck> = new Map();
  private lastResults: Map<string, HealthResult> = new Map();
  private logger = new Logger({ tag: "HealthMonitor" });

  /**
   * Register a health check
   */
  registerCheck(name: string, check: HealthCheck): void {
    this.checks.set(name, check);
    this.logger.info(`Registered health check: ${name}`);
  }

  /**
   * Unregister a health check
   */
  unregisterCheck(name: string): void {
    this.checks.delete(name);
    this.lastResults.delete(name);
    this.logger.info(`Unregistered health check: ${name}`);
  }

  /**
   * Run all health checks
   */
  async runAllChecks(): Promise<OverallHealth> {
    const results: HealthResult[] = [];
    const start = Date.now();

    for (const [name, check] of this.checks.entries()) {
      try {
        const result = await this.runCheck(name, check);
        results.push(result);
      } catch (error) {
        const errorResult: HealthResult = {
          name,
          status: 'unhealthy',
          message: `Check execution failed: ${error}`,
          timestamp: Date.now(),
          duration: 0,
          details: { error: String(error) }
        };
        results.push(errorResult);
        this.lastResults.set(name, errorResult);
      }
    }

    const overallDuration = Date.now() - start;
    const overall = this.calculateOverallHealth(results, overallDuration);

    this.logger.info(`Health check completed: ${overall.status} (${results.length} checks, ${overallDuration}ms)`);
    return overall;
  }

  /**
   * Run a specific health check
   */
  async runCheck(name: string, check?: HealthCheck): Promise<HealthResult> {
    const healthCheck = check || this.checks.get(name);
    if (!healthCheck) {
      throw new Error(`Health check not found: ${name}`);
    }

    const start = Date.now();
    try {
      const result = await healthCheck.check();
      const duration = Date.now() - start;

      const healthResult: HealthResult = {
        name,
        status: result.healthy ? 'healthy' : 'unhealthy',
        message: result.message || (result.healthy ? 'OK' : 'Check failed'),
        timestamp: Date.now(),
        duration,
        details: result.details || {}
      };

      this.lastResults.set(name, healthResult);
      return healthResult;
    } catch (error) {
      const duration = Date.now() - start;
      const errorResult: HealthResult = {
        name,
        status: 'unhealthy',
        message: `Check failed with error: ${error}`,
        timestamp: Date.now(),
        duration,
        details: { error: String(error) }
      };

      this.lastResults.set(name, errorResult);
      return errorResult;
    }
  }

  /**
   * Get the last result for a check
   */
  getLastResult(name: string): HealthResult | null {
    return this.lastResults.get(name) || null;
  }

  /**
   * Get all last results
   */
  getAllLastResults(): Record<string, HealthResult> {
    const result: Record<string, HealthResult> = {};
    for (const [name, healthResult] of this.lastResults.entries()) {
      result[name] = healthResult;
    }
    return result;
  }

  private calculateOverallHealth(results: HealthResult[], duration: number): OverallHealth {
    const healthyCount = results.filter(r => r.status === 'healthy').length;
    const unhealthyCount = results.filter(r => r.status === 'unhealthy').length;
    const warningCount = results.filter(r => r.status === 'warning').length;

    let status: 'healthy' | 'warning' | 'unhealthy';
    if (unhealthyCount === 0) {
      status = warningCount > 0 ? 'warning' : 'healthy';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      score: (healthyCount / results.length) * 100,
      totalChecks: results.length,
      healthyChecks: healthyCount,
      unhealthyChecks: unhealthyCount,
      warningChecks: warningCount,
      duration,
      timestamp: Date.now(),
      checks: results
    };
  }
}

/**
 * Memory usage monitor
 */
export class MemoryMonitor {
  private samples: MemorySample[] = [];
  private maxSamples: number = 100;
  private logger = new Logger({ tag: "MemoryMonitor" });

  /**
   * Take a memory sample
   */
  sample(): MemorySample {
    const sample: MemorySample = {
      timestamp: Date.now(),
      heapUsed: this.getHeapUsed(),
      heapTotal: this.getHeapTotal(),
      external: this.getExternalMemory(),
      mono: this.getMonoMemory(),
      process: this.getProcessMemory()
    };

    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    return sample;
  }

  /**
   * Get memory statistics
   */
  getStats(timeWindow?: number): MemoryStats | null {
    let filteredSamples = this.samples;
    if (timeWindow) {
      const cutoff = Date.now() - timeWindow;
      filteredSamples = this.samples.filter(s => s.timestamp >= cutoff);
    }

    if (filteredSamples.length === 0) {
      return null;
    }

    const heapUsedValues = filteredSamples.map(s => s.heapUsed);
    const heapTotalValues = filteredSamples.map(s => s.heapTotal);
    const monoValues = filteredSamples.map(s => s.mono.total).filter(v => v > 0);

    return {
      heapUsed: {
        current: heapUsedValues[heapUsedValues.length - 1],
        average: heapUsedValues.reduce((sum, val) => sum + val, 0) / heapUsedValues.length,
        peak: Math.max(...heapUsedValues),
        trend: this.calculateTrend(heapUsedValues)
      },
      heapTotal: {
        current: heapTotalValues[heapTotalValues.length - 1],
        average: heapTotalValues.reduce((sum, val) => sum + val, 0) / heapTotalValues.length,
        peak: Math.max(...heapTotalValues)
      },
      mono: monoValues.length > 0 ? {
        current: monoValues[monoValues.length - 1],
        average: monoValues.reduce((sum, val) => sum + val, 0) / monoValues.length,
        peak: Math.max(...monoValues),
        trend: this.calculateTrend(monoValues)
      } : null,
      samples: filteredSamples.length,
      timeRange: {
        start: Math.min(...filteredSamples.map(s => s.timestamp)),
        end: Math.max(...filteredSamples.map(s => s.timestamp))
      }
    };
  }

  /**
   * Clear memory samples
   */
  clear(): void {
    this.samples = [];
  }

  private getHeapUsed(): number {
    // Implementation would depend on runtime
    return 0;
  }

  private getHeapTotal(): number {
    // Implementation would depend on runtime
    return 0;
  }

  private getExternalMemory(): number {
    // Implementation would depend on runtime
    return 0;
  }

  private getMonoMemory(): { total: number; managed: number; gc: number } {
    // Implementation would use Mono GC APIs
    return { total: 0, managed: 0, gc: 0 };
  }

  private getProcessMemory(): { rss: number; vms: number } {
    // Implementation would use process APIs
    return { rss: 0, vms: 0 };
  }

  private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    const diff = secondAvg - firstAvg;
    const threshold = firstAvg * 0.1; // 10% threshold

    if (diff > threshold) return 'increasing';
    if (diff < -threshold) return 'decreasing';
    return 'stable';
  }
}

/**
 * Operation tracker for monitoring API usage
 */
export class OperationTracker {
  private operations: Map<string, OperationStats> = new Map();
  private logger = new Logger({ tag: "OperationTracker" });

  /**
   * Track the start of an operation
   */
  startOperation(name: string, metadata?: Record<string, any>): string {
    const operationId = this.generateOperationId();
    const operation: TrackedOperation = {
      id: operationId,
      name,
      startTime: Date.now(),
      metadata: metadata || {}
    };

    if (!this.operations.has(name)) {
      this.operations.set(name, {
        totalCalls: 0,
        totalTime: 0,
        errors: 0,
        averageTime: 0,
        lastCall: 0,
        activeOperations: new Map()
      });
    }

    const stats = this.operations.get(name)!;
    stats.activeOperations.set(operationId, operation);
    stats.totalCalls++;
    stats.lastCall = operation.startTime;

    return operationId;
  }

  /**
   * Track the completion of an operation
   */
  endOperation(operationId: string, success: boolean = true, error?: Error): void {
    const endTime = Date.now();

    for (const [name, stats] of this.operations.entries()) {
      const operation = stats.activeOperations.get(operationId);
      if (operation) {
        const duration = endTime - operation.startTime;
        stats.totalTime += duration;
        stats.averageTime = stats.totalTime / stats.totalCalls;

        if (!success) {
          stats.errors++;
        }

        stats.activeOperations.delete(operationId);

        if (duration > 1000) { // Log slow operations
          this.logger.warn(`Slow operation: ${name} took ${duration}ms`, {
            operationId,
            metadata: operation.metadata
          });
        }

        break;
      }
    }
  }

  /**
   * Get statistics for all operations
   */
  getAllStats(): Record<string, OperationStats> {
    const result: Record<string, OperationStats> = {};
    for (const [name, stats] of this.operations.entries()) {
      result[name] = {
        ...stats,
        activeOperations: new Map(stats.activeOperations) // Create copy
      };
    }
    return result;
  }

  /**
   * Get statistics for a specific operation
   */
  getStats(name: string): OperationStats | null {
    const stats = this.operations.get(name);
    if (!stats) return null;

    return {
      ...stats,
      activeOperations: new Map(stats.activeOperations) // Create copy
    };
  }

  /**
   * Clear all operation statistics
   */
  clear(): void {
    this.operations.clear();
  }

  private generateOperationId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}

/**
 * Global monitoring instance
 */
export class GlobalMonitor {
  public readonly performance = new PerformanceMetrics();
  public readonly health = new HealthMonitor();
  public readonly memory = new MemoryMonitor();
  public readonly operations = new OperationTracker();
  private logger = new Logger({ tag: "GlobalMonitor" });

  constructor() {
    this.initializeDefaultHealthChecks();
    this.startPeriodicMonitoring();
  }

  /**
   * Get comprehensive monitoring snapshot
   */
  async getSnapshot(): Promise<MonitoringSnapshot> {
    const [health, memory, operations, performanceStats] = await Promise.all([
      this.health.runAllChecks(),
      Promise.resolve(this.memory.getStats(300000)), // 5 minutes
      Promise.resolve(this.operations.getAllStats()),
      Promise.resolve(this.getPerformanceSummary())
    ]);

    return {
      timestamp: Date.now(),
      health,
      memory,
      operations,
      performance: performanceStats
    };
  }

  /**
   * Get performance summary
   */
  private getPerformanceSummary(): Record<string, any> {
    const summary: Record<string, any> = {};
    const metricNames = this.performance.getMetricNames();

    for (const name of metricNames) {
      const stats = this.performance.getStats(name, 300000); // 5 minutes
      if (stats) {
        summary[name] = {
          average: stats.mean,
          p95: stats.p95,
          p99: stats.p99,
          count: stats.count
        };
      }
    }

    return summary;
  }

  /**
   * Initialize default health checks
   */
  private initializeDefaultHealthChecks(): void {
    // Mono runtime health check
    this.health.registerCheck('mono-runtime', {
      check: async () => {
        // Check if Mono runtime is accessible
        try {
          if (typeof (globalThis as any).Mono !== 'undefined') {
            const monoApi = (globalThis as any).Mono.api;
            if (monoApi && monoApi.native) {
              const domain = monoApi.getRootDomain();
              if (domain && !domain.isNull()) {
                return { healthy: true, message: 'Mono runtime is accessible' };
              }
            }
          }
          return { healthy: false, message: 'Mono runtime not accessible' };
        } catch (error) {
          return { healthy: false, message: `Mono runtime check failed: ${error}` };
        }
      }
    });

    // Memory usage health check
    this.health.registerCheck('memory-usage', {
      check: async () => {
        const memoryStats = this.memory.getStats(60000); // 1 minute
        if (!memoryStats) {
          return { healthy: true, message: 'No memory data available' };
        }

        const heapUsagePercent = (memoryStats.heapUsed.current / memoryStats.heapTotal.current) * 100;

        if (heapUsagePercent > 90) {
          return {
            healthy: false,
            message: `High memory usage: ${heapUsagePercent.toFixed(1)}%`,
            details: { heapUsagePercent, heapUsed: memoryStats.heapUsed.current }
          };
        } else if (heapUsagePercent > 75) {
          return {
            healthy: true,
            message: `Moderate memory usage: ${heapUsagePercent.toFixed(1)}%`,
            details: { heapUsagePercent }
          };
        } else {
          return {
            healthy: true,
            message: `Memory usage normal: ${heapUsagePercent.toFixed(1)}%`,
            details: { heapUsagePercent }
          };
        }
      }
    });

    // Error rate health check
    this.health.registerCheck('error-rate', {
      check: async () => {
        const operationStats = this.operations.getAllStats();
        let totalCalls = 0;
        let totalErrors = 0;

        for (const stats of Object.values(operationStats)) {
          totalCalls += stats.totalCalls;
          totalErrors += stats.errors;
        }

        if (totalCalls === 0) {
          return { healthy: true, message: 'No operations recorded yet' };
        }

        const errorRate = (totalErrors / totalCalls) * 100;

        if (errorRate > 10) {
          return {
            healthy: false,
            message: `High error rate: ${errorRate.toFixed(1)}% (${totalErrors}/${totalCalls})`,
            details: { errorRate, totalErrors, totalCalls }
          };
        } else if (errorRate > 5) {
          return {
            healthy: true,
            message: `Moderate error rate: ${errorRate.toFixed(1)}%`,
            details: { errorRate }
          };
        } else {
          return {
            healthy: true,
            message: `Error rate normal: ${errorRate.toFixed(1)}%`,
            details: { errorRate, totalErrors, totalCalls }
          };
        }
      }
    });
  }

  /**
   * Start periodic monitoring
   */
  private startPeriodicMonitoring(): void {
    // Take memory sample every 30 seconds
    setInterval(() => {
      this.memory.sample();
    }, 30000);

    // Log health status every 5 minutes
    setInterval(async () => {
      try {
        const health = await this.health.runAllChecks();
        if (health.status !== 'healthy') {
          this.logger.warn(`Health check status: ${health.status}`, {
            score: health.score,
            issues: health.unhealthyChecks
          });
        }
      } catch (error) {
        this.logger.error(`Periodic health check failed: ${error}`);
      }
    }, 300000); // 5 minutes
  }
}

// Global monitor instance
export const globalMonitor = new GlobalMonitor();

// ===== INTERFACES AND TYPES =====

export interface MetricEntry {
  timestamp: number;
  value: number;
  unit: string;
  metadata: Record<string, any>;
}

export interface MetricStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  unit: string;
  timeRange: {
    start: number;
    end: number;
  };
}

export interface HealthCheck {
  check(): Promise<{
    healthy: boolean;
    message?: string;
    details?: Record<string, any>;
  }>;
}

export interface HealthResult {
  name: string;
  status: 'healthy' | 'warning' | 'unhealthy';
  message: string;
  timestamp: number;
  duration: number;
  details: Record<string, any>;
}

export interface OverallHealth {
  status: 'healthy' | 'warning' | 'unhealthy';
  score: number;
  totalChecks: number;
  healthyChecks: number;
  unhealthyChecks: number;
  warningChecks: number;
  duration: number;
  timestamp: number;
  checks: HealthResult[];
}

export interface MemorySample {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  mono: {
    total: number;
    managed: number;
    gc: number;
  };
  process: {
    rss: number;
    vms: number;
  };
}

export interface MemoryStats {
  heapUsed: {
    current: number;
    average: number;
    peak: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  heapTotal: {
    current: number;
    average: number;
    peak: number;
  };
  mono: {
    current: number;
    average: number;
    peak: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  } | null;
  samples: number;
  timeRange: {
    start: number;
    end: number;
  };
}

export interface TrackedOperation {
  id: string;
  name: string;
  startTime: number;
  metadata: Record<string, any>;
}

export interface OperationStats {
  totalCalls: number;
  totalTime: number;
  errors: number;
  averageTime: number;
  lastCall: number;
  activeOperations: Map<string, TrackedOperation>;
}

export interface MonitoringSnapshot {
  timestamp: number;
  health: OverallHealth;
  memory: MemoryStats | null;
  operations: Record<string, OperationStats>;
  performance: Record<string, any>;
}