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
import warnings
import pymongo
import os
from dotenv import load_dotenv

load_dotenv()

client = pymongo.MongoClient(os.environ.get('MONGODB_URI'))
db = client["NextStore"]

warnings.simplefilter(action='ignore', category=FutureWarning)


# # loading rating dataset
# ratings = pd.read_csv(
#     "https://s3-us-west-2.amazonaws.com/recommender-tutorial/ratings.csv")
# # print(ratings.head())

# # loading movie dataset
# movies = pd.read_csv(
#     "https://s3-us-west-2.amazonaws.com/recommender-tutorial/movies.csv")
# # print(movies.head())

ratings_collection = db["ratings"]
movies_collection = db["movies"]

ratings = pd.DataFrame(list(ratings_collection.find()))
movies = pd.DataFrame(list(movies_collection.find()))


n_ratings = len(ratings)
n_movies = len(ratings['movieId'].unique())
n_users = len(ratings['userId'].unique())

# print(f"Number of ratings: {n_ratings}")
# print(f"Number of unique movieId's: {n_movies}")
# print(f"Number of unique users: {n_users}")
# print(f"Average ratings per user: {round(n_ratings/n_users, 2)}")
# print(f"Average ratings per movie: {round(n_ratings/n_movies, 2)}")

user_freq = ratings[['userId', 'movieId']].groupby(
    'userId').count().reset_index()
user_freq.columns = ['userId', 'n_ratings']
# print(user_freq.head())


# Find Lowest and Highest rated movies:
mean_rating = ratings.groupby('movieId')[['rating']].mean()
# Lowest rated movies
lowest_rated = mean_rating['rating'].idxmin()
movies.loc[movies['movieId'] == lowest_rated]
# Highest rated movies
highest_rated = mean_rating['rating'].idxmax()
movies.loc[movies['movieId'] == highest_rated]
# show number of people who rated movies rated movie highest
ratings[ratings['movieId'] == highest_rated]
# show number of people who rated movies rated movie lowest
ratings[ratings['movieId'] == lowest_rated]

# the above movies has very low dataset. We will use bayesian average
movie_stats = ratings.groupby('movieId')[['rating']].agg(['count', 'mean'])
movie_stats.columns = movie_stats.columns.droplevel()


# Now, we create user-item matrix using scipy csr matrix


def create_matrix(df):

    N = len(df['userId'].unique())
    M = len(df['movieId'].unique())

    # Map Ids to indices
    user_mapper = dict(zip(np.unique(df["userId"]), list(range(N))))
    movie_mapper = dict(zip(np.unique(df["movieId"]), list(range(M))))

    # Map indices to IDs
    user_inv_mapper = dict(zip(list(range(N)), np.unique(df["userId"])))
    movie_inv_mapper = dict(zip(list(range(M)), np.unique(df["movieId"])))

    user_index = [user_mapper[i] for i in df['userId']]
    movie_index = [movie_mapper[i] for i in df['movieId']]

    X = csr_matrix((df["rating"], (movie_index, user_index)), shape=(M, N))

    return X, user_mapper, movie_mapper, user_inv_mapper, movie_inv_mapper


X, user_mapper, movie_mapper, user_inv_mapper, movie_inv_mapper = create_matrix(
    ratings)


"""
Find similar movies using KNN
"""


def find_similar_movies(movie_id, X, k, metric='cosine', show_distance=False):

    neighbour_ids = []

    movie_ind = movie_mapper[movie_id]
    movie_vec = X[movie_ind]
    k += 1
    kNN = NearestNeighbors(n_neighbors=k, algorithm="brute", metric=metric)
    kNN.fit(X)
    movie_vec = movie_vec.reshape(1, -1)
    neighbour = kNN.kneighbors(movie_vec, return_distance=show_distance)
    for i in range(0, k):
        n = neighbour.item(i)
        neighbour_ids.append(movie_inv_mapper[n])
    neighbour_ids.pop(0)
    return neighbour_ids


movie_titles = dict(zip(movies['movieId'], movies['title']))

movie_id = 3

similar_ids = find_similar_movies(movie_id, X, k=10)
movie_title = movie_titles[movie_id]

# print(f"Since you watched {movie_title}")
# for i in similar_ids:
#     print(movie_titles[i])


def recommend_movies_for_user(user_id, X, user_mapper, movie_mapper, movie_inv_mapper, k=10):
    df1 = ratings[ratings['userId'] == user_id]

    if df1.empty:
        print(f"User with ID {user_id} does not exist.")
        return

    movie_id = df1[df1['rating'] == max(df1['rating'])]['movieId'].iloc[0]

    movie_titles = dict(zip(movies['movieId'], movies['title']))

    similar_ids = find_similar_movies(movie_id, X, k)
    movie_title = movie_titles.get(movie_id, "Movie not found")

    if movie_title == "Movie not found":
        print(f"Movie with ID {movie_id} not found.")
        return

    # print(f"Since you watched {movie_title}, you might also like:")
    # for i in similar_ids:
    #     print(movie_titles.get(i, "Movie not found"))

    recommendations = []
    for i in similar_ids:
        recommendations.append(movie_titles.get(i, "Movie not found"))

    output_data = {
        "movie_watched": movie_title,
        "recommendations": recommendations
    }

    print(json.dumps(output_data))


# user_id = 150  # Replace with the desired user ID
# recommend_movies_for_user(user_id, X, user_mapper,
#                           movie_mapper, movie_inv_mapper, k=10)


# user_id = sys.argv[1]  # Replace with the desired user ID

parser = argparse.ArgumentParser()
parser.add_argument('--userId', type=int, required=True)
args = parser.parse_args()
user_id = args.userId
recommend_movies_for_user(user_id, X, user_mapper,
                          movie_mapper, movie_inv_mapper, k=10)
