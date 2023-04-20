'use strict';
module.exports = function(sequelize, DataTypes) {

	var implementation = sequelize.define('implementation', {language: DataTypes.STRING, fileName: DataTypes.STRING},{
		indexes: [
			{ unique: true, fields: [ 'language', 'stepId' ] }
		]
	});

	implementation.associate = function(models) {
		implementation.belongsTo(models.step, {onDelete: "CASCADE", foreignKey:{allowNull: false}});
	};

	return implementation;

};
