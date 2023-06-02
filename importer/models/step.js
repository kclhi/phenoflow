'use strict';
module.exports = function(sequelize, DataTypes) {

	var step = sequelize.define('step', {
		name: {
		 type: DataTypes.STRING,
		 allowNull: false
		},
		doc: DataTypes.STRING,
		type: DataTypes.STRING,
		position: {
			type: DataTypes.INTEGER,
			allowNull: false
		}
	},
	{
		indexes: [
			{ unique: true, fields: [ 'name', 'position', 'workflowId' ] },
			{ unique: true, fields: [ 'name', 'workflowId' ] },
			{ unique: true, fields: [ 'position', 'workflowId' ] }
		]
	});

	step.associate = function(models) {
		step.belongsTo(models.workflow, {
			onDelete: "CASCADE",
			foreignKey: {
				allowNull: false
			}
		});
	};

	return step;

};
