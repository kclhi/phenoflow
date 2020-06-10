'use strict';
module.exports = function(sequelize, DataTypes) {

	var child = sequelize.define('child', {name:DataTypes.STRING, distinctStepName:DataTypes.STRING, distinctStepPosition:DataTypes.INTEGER});

	return child;

};
