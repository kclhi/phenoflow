'use strict';
module.exports = function(sequelize, DataTypes) {

	var workflow = sequelize.define('workflow', {
		name: DataTypes.STRING,
		author: DataTypes.STRING,
		about: DataTypes.STRING
	});

	return workflow;

};
