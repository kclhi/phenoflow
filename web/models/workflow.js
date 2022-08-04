'use strict';
module.exports = function(sequelize, DataTypes) {

	var workflow = sequelize.define('workflow', {
    id: {
      primaryKey: true,
      type: DataTypes.STRING,
      allowNull: false
    },
		name: DataTypes.STRING,
		about: DataTypes.STRING,
		complete: {
			type: DataTypes.BOOLEAN,
			defaultValue: false
		}
	});

	workflow.associate = function(models) {
		workflow.belongsTo(models.user, {onDelete:"CASCADE", foreignKey:{allowNull: false}});
		workflow.belongsToMany(models.workflow, {onDelete:"CASCADE", as:"parent", through:models.child});
	};

	return workflow;

};
