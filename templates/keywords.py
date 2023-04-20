# [AUTHOR], [YEAR].

import sys, pickle, csv, swifter, re
import pandas as pd

def text_to_cols(data, cols, positive_dict, exclusions_dict = None):

    # Detect positives
    output_dict = init_dict(positive_dict.keys())

    for K, V in positive_dict.items():
        mid_dict = init_dict(positive_dict[K])

        for v in V:
            mid_dict[v] = search_and_merge(data, cols, v)

        output_dict[K] = pd.DataFrame(mid_dict).swifter.apply(lambda row: row.any(), axis = 1)

    if type(exclusions_dict) is not dict:
        return pd.DataFrame(output_dict)

    # Detect false positives
    false_positives = init_dict(exclusions_dict.keys())

    for K, V in exclusions_dict.items():
        mid_dict = init_dict(exclusions_dict[K])

        for v in V:
            mid_dict[v] = search_and_merge(data, cols, v)

        false_positives[K] = pd.DataFrame(mid_dict).swifter.apply(lambda row: row.any(), axis = 1)


    # Remove false positives
    all_positives = pd.DataFrame(output_dict)
    false_positives = pd.DataFrame(false_positives)
    true_positives = all_positives.copy()

    for col in false_positives.columns:
        true_positives[col] = np.where(~false_positives[col],
                                      all_positives[col],
                                      False)

    return true_positives

def init_dict(keys):
    output_dict = dict.fromkeys(keys)

    return output_dict

def search_and_merge(data, cols, v):
    x = data[cols].\
            swifter.apply(lambda col: col.str.contains(v, flags = re.IGNORECASE, na = False,
                                              regex = True), axis = 0).\
            swifter.apply(lambda row: row.any(), axis = 1)
    return x

data = pd.read_csv(sys.argv[1], dtype="object");
conditions = text_to_cols(data, [*data], {'[CATEGORY]-identified': [[LIST]]});
conditions = conditions['[CATEGORY]-identified'].replace(True, 'CASE').replace(False, 'UNK');
pd.concat([data, conditions], axis=1).to_csv('[PHENOTYPE]-potential-cases.csv', index=False);
