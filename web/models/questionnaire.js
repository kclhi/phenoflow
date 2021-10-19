'use strict';
module.exports = function(sequelize, DataTypes) {

	var questionnaire = sequelize.define('questionnaire', {
		username: DataTypes.STRING,
		answers: DataTypes.STRING,
		createdAt: {
			type: DataTypes.DATE,
			defaultValue: false
		},
		updatedAt: {
			type: DataTypes.DATE,
			defaultValue: false
		}
	});

	// questionnaire.associate = function(models) {
	// 	questionnaire.belongsTo(models.user, {onDelete:"CASCADE", foreignKey:{allowNull: false}});
	// };

	return questionnaire;

};
