'use strict';
module.exports = function(sequelize, DataTypes) {

	var step = sequelize.define('step', {

		id: {
		 type: DataTypes.INTEGER,
		 autoIncrement: true,
		 primaryKey: true
		},
		workflowId: DataTypes.INTEGER,
		stepId: DataTypes.STRING,
		doc: DataTypes.STRING,
		type: DataTypes.STRING,
		language: DataTypes.STRING,
		position: DataTypes.INTEGER

	});

	return step;

};
