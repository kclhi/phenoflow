'use strict';
module.exports = function(sequelize, DataTypes) {

	var step = sequelize.define('step', {

		id: {
		 type: DataTypes.INTEGER,
		 autoIncrement: true,
		 primaryKey: true
		},
		stepId: DataTypes.TEXT,
		doc: DataTypes.STRING,
		type: DataTypes.STRING,
		position: DataTypes.INTEGER

	});

	step.associate = function(models) {

		step.belongsTo(models.workflow, {

			onDelete: "CASCADE",
			foreignKey: {
				allowNull: false
			}

		});

	};

	return step;

};
