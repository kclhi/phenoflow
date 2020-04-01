'use strict';
module.exports = function(sequelize, DataTypes) {

	var workflow = sequelize.define('workflow', {

		id: {
		 type: DataTypes.INTEGER,
		 autoIncrement: true,
		 primaryKey: true
		},
		author: DataTypes.STRING

	});

	return workflow;

};
