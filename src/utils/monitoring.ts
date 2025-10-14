/**
 * Simplified monitoring and metrics collection for Mono operations
 */

import { Logger } from "./log";

/**
 * Basic performance metrics collector
 */
export class PerformanceMetrics {
  private metrics: Map<string, MetricEntry[]> = new Map();
  private maxEntries: number = 100;

  record(name: string, value: number, unit: string = 'ms'): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const entries = this.metrics.get(name)!;
    entries.push({
      timestamp: Date.now(),
      value,
      unit
    });

    // Trim old entries
    if (entries.length > this.maxEntries) {
      entries.splice(0, entries.length - this.maxEntries);
    }
  }

  getStats(name: string): MetricStats | null {
    const entries = this.metrics.get(name);
    if (!entries || entries.length === 0) {
      return null;
    }

    const values = entries.map(e => e.value);
    const sorted = [...values].sort((a, b) => a - b);

    return {
      count: entries.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: values.reduce((sum, val) => sum + val, 0) / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      unit: entries[0].unit
    };
  }

  clear(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }
}

/**
 * Basic operation tracker
 */
export class OperationTracker {
  private operations: Map<string, OperationStats> = new Map();

  startOperation(name: string): string {
    const operationId = Math.random().toString(36).substr(2, 9);

    if (!this.operations.has(name)) {
      this.operations.set(name, {
        totalCalls: 0,
        totalTime: 0,
        errors: 0,
        averageTime: 0
      });
    }

    const stats = this.operations.get(name)!;
    stats.totalCalls++;
    stats.lastStartTime = Date.now();

    return operationId;
  }

  endOperation(name: string, success: boolean = true, duration?: number): void {
    const stats = this.operations.get(name);
    if (!stats) return;

    const opDuration = duration || (Date.now() - (stats.lastStartTime || Date.now()));
    stats.totalTime += opDuration;
    stats.averageTime = stats.totalTime / stats.totalCalls;

    if (!success) {
      stats.errors++;
    }
  }

  getStats(name: string): OperationStats | null {
    return this.operations.get(name) || null;
  }

  getAllStats(): Record<string, OperationStats> {
    const result: Record<string, OperationStats> = {};
    for (const [name, stats] of this.operations.entries()) {
      result[name] = { ...stats };
    }
    return result;
  }

  clear(): void {
    this.operations.clear();
  }
}

// Global instances
export const performanceMetrics = new PerformanceMetrics();
export const operationTracker = new OperationTracker();

// Interfaces
export interface MetricEntry {
  timestamp: number;
  value: number;
  unit: string;
}

export interface MetricStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  unit: string;
}

export interface OperationStats {
  totalCalls: number;
  totalTime: number;
  errors: number;
  averageTime: number;
  lastStartTime?: number;
}