import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface ExecutionAttributes {
  id: string;
  projectId: string;
  language: string;
  code: string;
  output: string;
  exitCode: number;
  executionTime: number;
  status: 'success' | 'error' | 'timeout';
  createdAt?: Date;
}

interface ExecutionCreationAttributes extends Optional<ExecutionAttributes, 'id' | 'output' | 'exitCode' | 'executionTime'> {}

export class ExecutionHistory extends Model<ExecutionAttributes, ExecutionCreationAttributes> implements ExecutionAttributes {
  public id!: string;
  public projectId!: string;
  public language!: string;
  public code!: string;
  public output!: string;
  public exitCode!: number;
  public executionTime!: number;
  public status!: 'success' | 'error' | 'timeout';
  public readonly createdAt!: Date;
}

ExecutionHistory.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    projectId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'project_id',
    },
    language: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    code: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    output: {
      type: DataTypes.TEXT,
      defaultValue: '',
    },
    exitCode: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'exit_code',
    },
    executionTime: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'execution_time',
    },
    status: {
      type: DataTypes.ENUM('success', 'error', 'timeout'),
      defaultValue: 'success',
    },
  },
  {
    sequelize,
    tableName: 'execution_history',
    timestamps: true,
    updatedAt: false,
  }
);
