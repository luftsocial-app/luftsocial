import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { WorkflowTemplate } from './workflow-template.entity';

@Entity('workflow_steps')
export class WorkflowStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  order: number;

  @Column()
  requiredRole: string;

  @Column({ nullable: true })
  estimatedTimeInHours: number;

  @ManyToOne(() => WorkflowTemplate, (template) => template.steps)
  @JoinColumn({ name: 'workflow_template_id' })
  workflowTemplate: WorkflowTemplate;

  @Column({ name: 'workflow_template_id' })
  workflowTemplateId: string;
}
