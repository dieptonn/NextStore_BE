# Importing Libraries
import json
import argparse
from sklearn.neighbors import NearestNeighbors
from scipy.sparse import csr_matrix
import numpy as np
import pandas as pd
import sklearn
import sys
import matplotlib.pyplot as plt
import seaborn as sns

import os


input_data = sys.stdin.read()

# Chuyển đổi dữ liệu JSON thành đối tượng Python
data = json.loads(input_data)

# Lấy userId và PDs_json từ đối tượng Python
user_id = int(data['userId'])
PDs_json = data['PDs_json']
ratings_json = data['ratings_json']

# Tạo dataframe từ PDs_json
PDs = pd.DataFrame(PDs_json)
ratings = pd.DataFrame(ratings_json)


# Thực hiện xử lý dữ liệu hoặc các thao tác khác với dataframe ở đây

# In dataframe để kiểm tra


def create_matrix(df):

    N = len(df['userId'].unique())
    M = len(df['PD_id'].unique())

    # Map Ids to indices
    user_mapper = dict(zip(np.unique(df["userId"]), list(range(N))))
    PD_mapper = dict(zip(np.unique(df["PD_id"]), list(range(M))))

    # Map indices to IDs
    user_inv_mapper = dict(zip(list(range(N)), np.unique(df["userId"])))
    PD_inv_mapper = dict(zip(list(range(M)), np.unique(df["PD_id"])))

    user_index = [user_mapper[i] for i in df['userId']]
    PD_index = [PD_mapper[i] for i in df['PD_id']]

    X = csr_matrix((df["rating"], (PD_index, user_index)), shape=(M, N))

    return X, user_mapper, PD_mapper, user_inv_mapper, PD_inv_mapper


X, user_mapper, PD_mapper, user_inv_mapper, PD_inv_mapper = create_matrix(
    ratings)


def find_similar_PDs(PD_id, X, k, metric='cosine', show_distance=False):

    neighbour_ids = []

    PD_ind = PD_mapper[PD_id]
    PD_vec = X[PD_ind]
    k += 1
    kNN = NearestNeighbors(n_neighbors=k, algorithm="brute", metric=metric)
    kNN.fit(X)
    PD_vec = PD_vec.reshape(1, -1)
    neighbour = kNN.kneighbors(PD_vec, return_distance=show_distance)
    for i in range(0, k):
        n = neighbour.item(i)
        neighbour_ids.append(PD_inv_mapper[n])
    neighbour_ids.pop(0)
    return neighbour_ids


def recommend_PDs_for_user(user_id, X, user_mapper, PD_mapper, PD_inv_mapper, k=6):
    df1 = ratings[ratings['userId'] == user_id]

    if df1.empty:
        print(f"User with ID {user_id} does not exist.")
        return

    PD_id = df1[df1['rating'] == max(df1['rating'])]['PD_id'].iloc[0]

    PD_titles = dict(zip(PDs['PD_id'], PDs['name']))

    similar_ids = find_similar_PDs(PD_id, X, k)
    PD_title = PD_titles.get(PD_id, "PD not found")

    if PD_title == "PD not found":
        print(f"PD with ID {PD_id} not found.")
        return

    recommendations = []
    for i in similar_ids:
        recommendations.append(PD_titles.get(i, "PD not found"))

    output_data = {
        "PD_bought": PD_title,
        "recommendations": recommendations
    }

    print(json.dumps(output_data, ensure_ascii=False))


recommend_PDs_for_user(user_id, X, user_mapper,
                       PD_mapper, PD_inv_mapper, k=6)
