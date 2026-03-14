import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface FileAttributes {
  id: string;
  projectId: string;
  name: string;
  path: string;
  content: string;
  language: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface FileCreationAttributes extends Optional<FileAttributes, 'id' | 'content'> {}

export class File extends Model<FileAttributes, FileCreationAttributes> implements FileAttributes {
  public id!: string;
  public projectId!: string;
  public name!: string;
  public path!: string;
  public content!: string;
  public language!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

File.init(
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
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    path: {
      type: DataTypes.STRING(1024),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      defaultValue: '',
    },
    language: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'files',
    timestamps: true,
  }
);
