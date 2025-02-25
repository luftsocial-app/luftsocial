export class CreateTaskDto {
  title: string;
  done: boolean;
  constructor(title: string, done: boolean) {
    this.title = title;
    this.done = done;
  }
}

export class UpdateTaskDto {
  id: string;
  title: string;
  done: boolean;
  constructor(id: string, title: string, done: boolean) {
    this.title = title;
    this.done = done;
  }
}
