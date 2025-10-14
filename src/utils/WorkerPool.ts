/**
 * Task to be executed by a worker
 */
export interface WorkerTask {
  id: string;
  message: any;
  onTileUpdate?: (x: number, y: number, z: number, tileId: string) => void;
}

/**
 * Response from a worker
 */
export interface WorkerResponse {
  taskId: string;
  data: any;
}

/**
 * Worker pool for parallel task execution
 */
export class WorkerPool {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private taskQueue: Array<{
    task: WorkerTask;
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }> = [];
  private activeTasksCount = 0;

  constructor(workerCount: number | boolean = true) {
    const count = this.resolveWorkerCount(workerCount);

    // Create workers
    for (let i = 0; i < count; i++) {
      const worker = new Worker(new URL("../wfc.worker.ts", import.meta.url), {
        type: "module",
      });
      this.workers.push(worker);
      this.availableWorkers.push(worker);
    }
  }

  /**
   * Resolve worker count from config
   */
  private resolveWorkerCount(config: number | boolean): number {
    if (typeof config === "boolean") {
      return config ? navigator.hardwareConcurrency || 4 : 1;
    }

    const maxWorkers = navigator.hardwareConcurrency || 4;
    return Math.min(Math.max(1, config), maxWorkers);
  }

  /**
   * Execute a task on an available worker
   */
  async executeTask(task: WorkerTask): Promise<any> {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process the task queue
   */
  private processQueue(): void {
    while (this.availableWorkers.length > 0 && this.taskQueue.length > 0) {
      const worker = this.availableWorkers.shift()!;
      const queueItem = this.taskQueue.shift()!;

      this.executeTaskOnWorker(worker, queueItem.task)
        .then(queueItem.resolve)
        .catch(queueItem.reject);
    }
  }

  /**
   * Execute a task on a specific worker
   */
  private async executeTaskOnWorker(
    worker: Worker,
    task: WorkerTask
  ): Promise<any> {
    this.activeTasksCount++;

    return new Promise((resolve, reject) => {
      const messageHandler = (e: MessageEvent) => {
        const message = e.data;

        // Handle tile update messages
        if (message.type === "tile_update") {
          if (task.onTileUpdate) {
            task.onTileUpdate(message.x, message.y, message.z, message.tileId);
          }
          return; // Don't cleanup, continue processing
        }

        // Only handle completion and error messages
        if (message.type === "complete") {
          cleanup();
          this.activeTasksCount--;
          this.availableWorkers.push(worker);
          this.processQueue();

          if (message.success && message.data) {
            resolve(message.data);
          } else {
            reject(new Error("Task failed - contradiction occurred"));
          }
        } else if (message.type === "error") {
          cleanup();
          this.activeTasksCount--;
          this.availableWorkers.push(worker);
          this.processQueue();
          reject(new Error(message.message));
        }
        // Progress messages are handled elsewhere
      };

      const errorHandler = (error: ErrorEvent) => {
        cleanup();
        this.activeTasksCount--;
        this.availableWorkers.push(worker);
        this.processQueue();
        reject(error);
      };

      const cleanup = () => {
        worker.removeEventListener("message", messageHandler);
        worker.removeEventListener("error", errorHandler);
      };

      worker.addEventListener("message", messageHandler);
      worker.addEventListener("error", errorHandler);

      // Send task to worker
      worker.postMessage(task.message);
    });
  }

  /**
   * Get number of active workers
   */
  getActiveWorkerCount(): number {
    return this.activeTasksCount;
  }

  /**
   * Get total number of workers
   */
  getWorkerCount(): number {
    return this.workers.length;
  }

  /**
   * Terminate all workers
   */
  terminate(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
    this.activeTasksCount = 0;
  }
}
