'use strict';
module.exports = function(sequelize, DataTypes) {

	var input = sequelize.define('input', {

		id: {
		 type: DataTypes.INTEGER,
		 autoIncrement: true,
		 primaryKey: true
		},
		inputId: DataTypes.STRING,
		doc: DataTypes.STRING

	});

	input.associate = function(models) {

		input.belongsTo(models.step, {

			onDelete: "CASCADE",
			foreignKey: {

				allowNull: false

			}

		});

	};

	return input;

};
