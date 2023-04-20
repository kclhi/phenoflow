'use strict';
module.exports = function(sequelize, DataTypes) {

	var doi = sequelize.define('doi', {
		doi: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    implementationHash: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    } 
	});

	doi.associate = function(models) {
		doi.belongsTo(models.workflow);
	};

	return doi;

};
