'use strict';
module.exports = function(sequelize, DataTypes) {

	var children = sequelize.define('children', {name:DataTypes.STRING, distinctStepName:DataTypes.STRING, distinctStepPosition:DataTypes.INTEGER});
	return children;

};
