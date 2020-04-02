'use strict';
module.exports = function(sequelize, DataTypes) {

	var workflow = sequelize.define('workflow', {

		id: {
		 type: DataTypes.INTEGER,
		 autoIncrement: true,
		 primaryKey: true
		},
		name: DataTypes.STRING,
		author: DataTypes.STRING,
		about: DataTypes.STRING

	});

	return workflow;

};
