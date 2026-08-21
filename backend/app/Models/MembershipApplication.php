<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MembershipApplication extends Model
{
    protected $table = 'membership_applications';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['user_id', 'first_name', 'last_name', 'email', 'phone', 'company_name', 'position', 'industry', 'membership_tier', 'status', 'submitted_at', 'reviewed_at', 'reviewed_by', 'notes'];


    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = \Illuminate\Support\Str::uuid()->toString();
            }
        });
    }
}
