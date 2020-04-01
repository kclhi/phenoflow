'use strict';
module.exports = function(sequelize, DataTypes) {

	var output = sequelize.define('output', {

		id: {
		 type: DataTypes.INTEGER,
		 autoIncrement: true,
		 primaryKey: true
	 	},
		doc: DataTypes.STRING,
		extension: DataTypes.STRING

	});

	output.associate = function(models) {

		output.belongsTo(models.step, {

			onDelete: "CASCADE",
			foreignKey: {
				allowNull: false
			}

		});

	};

	return output;

};
