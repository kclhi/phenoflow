'use strict';
module.exports = function(sequelize, DataTypes) {

	var step = sequelize.define('step', {
		stepId: {
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
			{ unique: true, fields: [ 'stepId', 'position', 'workflowId' ] },
			{ unique: true, fields: [ 'stepId', 'workflowId' ] },
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
