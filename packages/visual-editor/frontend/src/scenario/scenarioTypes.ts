export type Task = {
  index: number;
  html: string;
  css: string;
};

export type Lesson = {
  name: string;
  Explanation: React.ComponentType;
  tasks: Task[];
};