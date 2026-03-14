import { Project } from './Project';
import { File } from './File';
import { ExecutionHistory } from './ExecutionHistory';

// Associations
Project.hasMany(File, { foreignKey: 'project_id', as: 'files' });
File.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

Project.hasMany(ExecutionHistory, { foreignKey: 'project_id', as: 'executions' });
ExecutionHistory.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

export { Project, File, ExecutionHistory };
